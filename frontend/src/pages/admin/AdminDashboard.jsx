import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import {
    Users, Home, AlertOctagon, FileText, Download, TrendingUp, Activity, BarChart3, LogOut, MapPin, Menu, Bell, ChevronRight, PieChart, LineChart, Grid
} from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, ArcElement);

// Import components
import OperatorList from '../../components/admin/OperatorList';
import FraudLogTable from '../../components/admin/FraudLogTable';
import Settings from '../../components/admin/Settings';
import AuditLogTable from '../../components/admin/AuditLogTable';
import Sidebar from '../../components/admin/Sidebar';
import { Toaster } from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationContext';

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Get notifications
    const { unreadCount, markAllAsRead } = useNotifications() || { unreadCount: 0, markAllAsRead: () => { } }; // Fallback if context missing (shouldn't happen)

    // Get active tab from URL query params or default to 'dashboard'
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'dashboard';

    const [activeTab, setActiveTabState] = useState(initialTab);
    const [chartPeriod, setChartPeriod] = useState('24h');
    const [chartView, setChartView] = useState('line');
    const [chartStats, setChartStats] = useState({ labels: [], data: [], fraud_data: [] });
    const [heatmapData, setHeatmapData] = useState({ data: [], booths: [] });
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);

    // Sync state with URL changes (e.g. browser back button)
    useEffect(() => {
        const currentTab = new URLSearchParams(location.search).get('tab') || 'dashboard';
        setActiveTabState(currentTab);
    }, [location.search]);

    // Wrapper to update URL when changing tab
    const setActiveTab = (tab) => {
        setActiveTabState(tab);
        navigate(`?tab=${tab}`);
    };
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        verified_voters: 0,
        total_operators: 0,
        active_operators: 0,
        total_voters: 0,
        total_fraud_alerts: 0,
        verifications_today: 0
    });

    // New state for extended dashboard
    const [recentFraudLogs, setRecentFraudLogs] = useState([]);
    const [boothStatuses, setBoothStatuses] = useState([]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleString()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Auto-refresh data every 10 seconds for real-time updates
    useEffect(() => {
        const interval = setInterval(() => {
            if (activeTab === 'dashboard' || activeTab === 'fraud' || activeTab === 'audit') {
                setRefreshTrigger(prev => !prev);
            }
        }, 10000);
        return () => clearInterval(interval);
    }, [activeTab]);

    const [refreshTrigger, setRefreshTrigger] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'dashboard') {
                    const [statsRes, fraudRes, opsRes] = await Promise.all([
                        axios.get('/auth/admin/stats/'),
                        axios.get('/auth/admin/fraud-logs/'), // recent logs
                        axios.get('/auth/admin/operators/')
                    ]);

                    setStats(statsRes.data);
                    // Handle paginated response (obj.logs) or flat list (array)
                    const fraudList = Array.isArray(fraudRes.data) ? fraudRes.data : (fraudRes.data.logs || []);
                    setRecentFraudLogs(fraudList.slice(0, 5));
                    setBoothStatuses(opsRes.data.slice(0, 4));
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeTab, refreshTrigger]);

    // Separate effect for Chart to avoid reloading everything
    useEffect(() => {
        const fetchChart = async () => {
            if (activeTab !== 'dashboard') return;
            try {
                const [chartRes, heatmapRes] = await Promise.all([
                    axios.get(`/auth/admin/voter-stats-chart/?period=${chartPeriod}`),
                    axios.get('/auth/admin/heatmap-data/')
                ]);
                setChartStats(chartRes.data);
                setHeatmapData(heatmapRes.data);
            } catch (err) {
                console.error("Chart fetch error", err);
            }
        };
        fetchChart();
    }, [activeTab, chartPeriod, refreshTrigger]);

    const handleExport = async () => {
        try {
            const response = await axios.get('/auth/admin/export-report/', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `admin_report_${new Date().toISOString()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Export failed", error);
            alert("Failed to export report");
        }
    };

    const chartData = {
        labels: chartStats.labels && chartStats.labels.length > 0 ? chartStats.labels : ['No Data'],
        datasets: [
            {
                label: 'Verified Voters',
                data: chartStats.data && chartStats.data.length > 0 ? chartStats.data : [0],
                borderColor: '#4F46E5', // Indigo-600
                borderWidth: 3,
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.5)'); // Indigo-600 with opacity
                    gradient.addColorStop(1, 'rgba(79, 70, 229, 0.05)');
                    return gradient;
                },
                fill: true,
                tension: 0.4, // Smooth curve
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#4F46E5',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
            },
            {
                label: 'Fraud Alerts',
                data: chartStats.fraud_data && chartStats.fraud_data.length > 0 ? chartStats.fraud_data : [0],
                borderColor: '#EF4444', // Red-500
                borderWidth: 3,
                backgroundColor: 'rgba(239, 68, 68, 0.1)', // Red-500 with opacity
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#EF4444',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
            }
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1E293B',
                titleColor: '#F8FAFC',
                bodyColor: '#F8FAFC',
                padding: 12,
                cornerRadius: 8,
                displayColors: false,
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    borderDash: [5, 5],
                    color: '#F1F5F9'
                },
                ticks: {
                    font: { size: 11 },
                    color: '#64748B'
                }
            },
            x: {
                grid: { display: false },
                ticks: {
                    font: { size: 11 },
                    color: '#64748B',
                    maxRotation: 0,
                    autoSkip: true,
                    maxTicksLimit: 8
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index',
        },
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'operators':
                return <OperatorList />;
            case 'fraud':
                return <FraudLogTable />;
            case 'audit':
                return <AuditLogTable />;
            case 'settings':
                return <Settings user={user} />;
            case 'dashboard':
            default:
                return (
                    <div className="space-y-6">
                        {loading ? <p>Loading stats...</p> : (
                            <>
                                {/* Stats Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Total Verified Today" value={stats.verifications_today} icon={<Activity className="w-5 h-5" />} trend="All Time" color="blue" />

                                    <StatCard
                                        label="Verified Voters"
                                        value={stats.verified_voters}
                                        icon={<Home className="w-5 h-5" />}
                                        subtext="of Total Voters"
                                        color="slate"
                                        progress={stats.total_voters ? (stats.verified_voters / stats.total_voters) * 100 : 0}
                                    />

                                    <StatCard
                                        label="Fraud Alerts"
                                        value={stats.total_fraud_alerts}
                                        icon={<AlertOctagon className="w-5 h-5" />}
                                        subtext="Requires Review"
                                        color="red"
                                        onClick={() => setActiveTab('fraud')}
                                    />

                                    <StatCard
                                        label="Operators"
                                        value={stats.total_operators}
                                        icon={<Users className="w-5 h-5" />}
                                        subtext={`${stats.active_operators || 0} Active`}
                                        color="slate"
                                        onClick={() => setActiveTab('operators')}
                                        progress={stats.total_operators ? ((stats.active_operators || 0) / stats.total_operators) * 100 : 0}
                                    />
                                </div>

                                {/* Graphs & Booths */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 sm:gap-0">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                                                {chartView === 'line' ? <TrendingUp className="w-4 h-4" /> : <PieChart className="w-4 h-4" />}
                                                {chartView === 'line' ? 'Verified Voters & Fraud Alerts' : 'Distribution Overview'}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-2">
                                                {/* View Toggle */}
                                                <div className="flex bg-slate-100 rounded-lg p-1 mr-2 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                    <button
                                                        onClick={() => setChartView('line')}
                                                        className={`p-1.5 rounded-md transition-all ${chartView === 'line' ? 'bg-white shadow text-janmat-blue dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                                        title="Line Chart"
                                                    >
                                                        <LineChart className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setChartView('doughnut')}
                                                        className={`p-1.5 rounded-md transition-all ${chartView === 'doughnut' ? 'bg-white shadow text-janmat-blue dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                                        title="Distribution Chart"
                                                    >
                                                        <PieChart className="w-4 h-4" />
                                                    </button>
                                                </div>

                                                <div className="flex bg-slate-100 rounded-lg p-1 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                                    <button onClick={() => setChartPeriod('24h')} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${chartPeriod === '24h' ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>24h</button>
                                                    <button onClick={() => setChartPeriod('7d')} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${chartPeriod === '7d' ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>7d</button>
                                                    <button onClick={() => setChartPeriod('30d')} className={`px-3 py-1 text-xs rounded-md font-bold transition-all ${chartPeriod === '30d' ? 'bg-white shadow text-slate-900 dark:bg-slate-700 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>30d</button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-64 w-full flex justify-center items-center relative">
                                            {chartView === 'line' ? (
                                                <Line data={chartData} options={chartOptions} />
                                            ) : (
                                                <div className="h-full w-full max-w-[300px] relative">
                                                    <Doughnut
                                                        data={{
                                                            labels: ['Verified Voters', 'Fraud Alerts'],
                                                            datasets: [{
                                                                data: [
                                                                    chartStats.data.reduce((a, b) => a + b, 0),
                                                                    chartStats.fraud_data.reduce((a, b) => a + b, 0)
                                                                ],
                                                                backgroundColor: ['#4F46E5', '#EF4444'],
                                                                borderColor: ['#ffffff', '#ffffff'],
                                                                borderWidth: 2,
                                                                hoverOffset: 4
                                                            }]
                                                        }}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            cutout: '65%',
                                                            plugins: {
                                                                legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, color: '#94a3b8' } },
                                                                tooltip: {
                                                                    backgroundColor: '#1E293B',
                                                                    padding: 12,
                                                                    cornerRadius: 8,
                                                                    callbacks: {
                                                                        label: (ctx) => ` ${ctx.label}: ${ctx.raw}`
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                    />
                                                    {/* Center Text for Doughnut */}
                                                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[60%] text-center pointer-events-none">
                                                        <p className="text-3xl font-bold text-slate-800 dark:text-white">
                                                            {chartStats.data.reduce((a, b) => a + b, 0) + chartStats.fraud_data.reduce((a, b) => a + b, 0)}
                                                        </p>
                                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide dark:text-slate-400">Total Events</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Heatmap Section */}
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                                                <Grid className="w-4 h-4" /> Booth Activity Heatmap (Last 24h)
                                            </h3>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <div className="min-w-[600px]">
                                                {/* Matrix Header (Hours) */}
                                                <div className="flex mb-2">
                                                    <div className="w-24 text-xs font-bold text-slate-500 dark:text-slate-400">Booth ID</div>
                                                    {Array.from({ length: 24 }).map((_, i) => (
                                                        <div key={i} className="flex-1 text-center text-[10px] text-slate-400">
                                                            {i.toString().padStart(2, '0')}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Matrix Rows */}
                                                {heatmapData.booths && heatmapData.booths.length > 0 ? (
                                                    heatmapData.booths.map(boothId => (
                                                        <div key={boothId} className="flex mb-1 items-center">
                                                            <div className="w-24 text-xs font-medium text-slate-600 truncate pr-2 dark:text-slate-300" title={boothId}>
                                                                {boothId}
                                                            </div>
                                                            {Array.from({ length: 24 }).map((_, hour) => {
                                                                const cell = heatmapData.data.find(d => d.booth === boothId && d.hour === hour);
                                                                const count = cell ? cell.count : 0;
                                                                // Color intensity logic
                                                                let bgClass = 'bg-slate-100 dark:bg-slate-700';
                                                                if (count > 0) bgClass = 'bg-indigo-100 dark:bg-indigo-900/30';
                                                                if (count > 2) bgClass = 'bg-indigo-300 dark:bg-indigo-800/50';
                                                                if (count > 5) bgClass = 'bg-indigo-500 dark:bg-indigo-600';
                                                                if (count > 10) bgClass = 'bg-indigo-700 dark:bg-indigo-500';

                                                                return (
                                                                    <div key={hour} className="flex-1 h-8 mx-0.5 rounded-sm relative group cursor-default">
                                                                        <div className={`w-full h-full rounded-sm ${bgClass} transition-colors`}></div>
                                                                        {/* Tooltip */}
                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 w-max px-2 py-1 bg-slate-800 text-white text-xs rounded shadow-lg">
                                                                            {hour}:00 - {count} Events
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm">
                                                        No activity data available for heatmap.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mt-4 flex items-center justify-end gap-4 text-xs text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 dark:bg-slate-700 rounded-sm"></div> 0</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-sm"></div> 1-2</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-300 dark:bg-indigo-800/50 rounded-sm"></div> 3-5</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-500 dark:bg-indigo-600 rounded-sm"></div> 6-10</div>
                                            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-indigo-700 dark:bg-indigo-500 rounded-sm"></div> 10+</div>
                                        </div>
                                    </div>
                                    {/* Booth Status System */}
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                                                Booth Status
                                            </h3>
                                        </div>
                                        <div className="space-y-4">
                                            {boothStatuses.length === 0 ? (
                                                <p className="text-sm text-slate-500 dark:text-slate-400">No active booths.</p>
                                            ) : (
                                                boothStatuses.map((op, idx) => (
                                                    <div key={idx} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0 dark:border-slate-700">
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-sm dark:text-slate-200">{op.booth_id || '??'}</p>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400">Operator: {op.full_name || op.name || 'Unknown'}</p>
                                                        </div>
                                                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${op.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                                                            {op.is_active ? 'Active' : 'Offline'}
                                                        </span>
                                                    </div>
                                                ))
                                            )}

                                            <button onClick={() => setActiveTab('operators')} className="w-full text-center text-xs font-bold text-janmat-blue hover:underline mt-2 dark:text-janmat-light">
                                                View all booths
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Fraud Logs */}
                                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6 dark:bg-slate-800 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg dark:text-white">Recent Fraud Logs</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => setActiveTab('fraud')} className="px-3 py-1 bg-janmat-blue text-white rounded text-xs font-bold hover:bg-janmat-hover">View all fraud logs</button>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-slate-400 uppercase border-b dark:border-slate-700">
                                                <tr>
                                                    <th className="py-3 font-medium">Timestamp</th>
                                                    <th className="py-3 font-medium">Voter (Masked)</th>
                                                    <th className="py-3 font-medium">Booth ID</th>
                                                    <th className="py-3 font-medium">Violation</th>
                                                    <th className="py-3 font-medium">Status</th>
                                                    <th className="py-3 font-medium text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {recentFraudLogs.length === 0 ? (
                                                    <tr><td colSpan="6" className="py-4 text-center text-slate-500 dark:text-slate-400">No recent fraud alerts.</td></tr>
                                                ) : (
                                                    recentFraudLogs.map((log) => (
                                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                                            <td className="py-3 text-slate-600 font-mono dark:text-slate-300">{new Date(log.flagged_at).toLocaleString()}</td>
                                                            <td className="py-3 text-slate-900 font-medium dark:text-white">{log.aadhaar_masked || 'Unknown'}</td>
                                                            <td className="py-3 text-slate-600 dark:text-slate-300">{log.booth_number}</td>
                                                            <td className="py-3 text-slate-600 dark:text-slate-300">{log.fraud_type}</td>
                                                            <td className="py-3">
                                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${log.reviewed ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}>
                                                                    {log.reviewed ? 'Reviewed' : 'Open'}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 text-right">
                                                                <button onClick={() => setActiveTab('fraud')} className="text-janmat-blue font-bold px-3 py-1 bg-slate-100 rounded hover:bg-slate-200 dark:bg-slate-600 dark:text-janmat-light dark:hover:bg-slate-500">
                                                                    {log.reviewed ? 'View' : 'Review'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                );
        }
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans overflow-hidden transition-colors duration-300">
            <Toaster position="top-right" />
            {/* Sidebar */}
            {/* Sidebar */}
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                user={user}
                logout={logout}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isCollapsed={sidebarCollapsed}
                setIsCollapsed={setSidebarCollapsed}
            />

            {/* Main Content Wrapper */}
            <div className={`
                flex-1 flex flex-col overflow-hidden relative transition-all duration-300
                ${sidebarCollapsed ? 'md:ml-[111px]' : 'md:ml-[280px]'}
            `}>
                {/* Top Header */}
                <header className="flex justify-between items-center p-4 md:p-8 border-b border-slate-200 bg-white shrink-0 dark:bg-slate-800 dark:border-slate-700 transition-colors duration-300">
                    <div className="flex items-center gap-4">
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                                {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                                {activeTab === 'dashboard' && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-bold uppercase tracking-wider border border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        Live
                                    </span>
                                )}
                            </h2>
                            <p className="text-xs md:text-sm text-slate-500 mt-1 hidden sm:block dark:text-slate-400">Server time: <span className="font-mono">{currentTime}</span></p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* Bell Icon for Notifications */}
                        <div className="relative">
                            <div
                                className="relative cursor-pointer hover:bg-slate-50 p-2 rounded-full transition-colors"
                                onClick={() => setNotificationDropdownOpen(!notificationDropdownOpen)}
                                title={`${unreadCount} unread alerts`}
                            >
                                <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-red-500' : 'text-slate-500'}`} />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1 right-1 flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                    </span>
                                )}
                            </div>

                            {/* Dropdown */}
                            {notificationDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                                        <h3 className="font-bold text-slate-700 text-sm dark:text-slate-200">Notifications</h3>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllAsRead}
                                                className="text-xs text-janmat-blue hover:underline font-medium dark:text-janmat-light"
                                            >
                                                Clear all
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-64 overflow-y-auto dark:bg-slate-800">
                                        {recentFraudLogs.filter(l => !l.reviewed).length === 0 ? (
                                            <p className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No new alerts.</p>
                                        ) : (
                                            recentFraudLogs.filter(l => !l.reviewed).slice(0, 5).map((log, i) => (
                                                <div key={i} className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:hover:bg-slate-700" onClick={() => { setActiveTab('fraud'); setNotificationDropdownOpen(false); }}>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{log.fraud_type}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1 flex justify-between dark:text-slate-400">
                                                        <span>Booth: {log.booth_number}</span>
                                                        <span>{new Date(log.flagged_at).toLocaleTimeString()}</span>
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="p-2 border-t border-slate-100 text-center bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                                        <button
                                            onClick={() => { setActiveTab('fraud'); setNotificationDropdownOpen(false); }}
                                            className="text-xs text-janmat-blue font-bold hover:underline dark:text-janmat-light"
                                        >
                                            View all logs
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600">
                            <Download className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                            <span className="hidden sm:inline">Export Report</span>
                        </button>
                    </div>
                </header>

                {/* Main Scrollable Area */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {renderContent()}
                </main>
            </div>
        </div>
    );
};

// Sub-components
// Sub-components
const StatCard = ({ label, value, icon, trend, subtext, color, onClick, progress }) => {
    const borderClass = color === 'blue' ? 'border-janmat-blue' : color === 'red' ? 'border-red-500' : 'border-slate-200 dark:border-slate-700';
    const iconBg = color === 'blue' ? 'bg-blue-50 text-janmat-blue dark:bg-slate-700 dark:text-janmat-light' : color === 'red' ? 'bg-red-50 text-red-600 dark:bg-red-900 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    const progressColor = color === 'blue' ? 'bg-janmat-blue dark:bg-janmat-light' : color === 'red' ? 'bg-red-500' : 'bg-slate-500 dark:bg-slate-400';
    const cardBg = 'bg-white dark:bg-slate-800';

    // Simple CountUp Animation
    const [displayValue, setDisplayValue] = React.useState(0);

    React.useEffect(() => {
        let start = displayValue;
        const end = parseInt(value) || 0;
        if (start === end) return;

        const duration = 1000;
        const increment = (end - start) / (duration / 16); // 60fps

        const timer = setInterval(() => {
            start += increment;
            if ((increment > 0 && start >= end) || (increment < 0 && start <= end)) {
                setDisplayValue(end);
                clearInterval(timer);
            } else {
                setDisplayValue(Math.round(start));
            }
        }, 16);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <div
            onClick={onClick}
            className={`${cardBg} border text-left p-6 rounded-lg shadow-sm transition-all border-l-4 ${borderClass} ${onClick ? 'cursor-pointer hover:shadow-md hover:translate-y-[-2px] group' : ''}`}
        >
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-500 text-sm font-medium mb-1 dark:text-slate-400">{label}</p>
                    <h3 className={`text-3xl font-bold ${color === 'red' ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>
                        {displayValue}
                    </h3>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`p-2 rounded-lg ${iconBg}`}>{icon}</span>
                    {onClick && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-janmat-blue transition-colors dark:text-slate-600 dark:group-hover:text-janmat-light" />}
                </div>
            </div>

            {progress !== undefined ? (
                <div className="mt-4">
                    <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs ${color === 'red' ? 'text-red-600 font-medium dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{subtext}</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 dark:bg-slate-700 overflow-hidden">
                        <div className={`h-1.5 rounded-full ${progressColor} transition-all duration-500`} style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}></div>
                    </div>
                </div>
            ) : (
                subtext && <p className={`text-xs mt-4 ${color === 'red' ? 'text-red-600 font-medium dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>{subtext}</p>
            )}
        </div>
    );
};

export default AdminDashboard;

