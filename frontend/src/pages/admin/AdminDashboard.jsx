import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import {
    Users, Home, AlertOctagon, FileText, Download, TrendingUp, Activity, BarChart3, LogOut, MapPin, Menu, Bell, ChevronRight, ChevronDown, Check, PieChart, LineChart
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
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import CustomDatePicker from '../../components/common/CustomDatePicker';

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();

    // Get notifications
    const { unreadCount, markAllAsRead } = useNotifications() || { unreadCount: 0, markAllAsRead: () => { } }; // Fallback if context missing (shouldn't happen)

    // Get active tab from URL query params or default to 'dashboard'
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'dashboard';

    const [activeTab, setActiveTabState] = useState(initialTab);
    const [chartPeriod, setChartPeriod] = useState('24h');
    const [chartView, setChartView] = useState('line');
    const [chartStats, setChartStats] = useState({ labels: [], data: [], fraud_data: [] });
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [notificationDropdownOpen, setNotificationDropdownOpen] = useState(false);
    const [unreadFraudLogs, setUnreadFraudLogs] = useState([]);
    const notificationRef = useRef(null);

    // Close notification dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notificationRef.current && !notificationRef.current.contains(e.target)) {
                setNotificationDropdownOpen(false);
            }
        };
        if (notificationDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [notificationDropdownOpen]);

    // Fetch actual unread logs when dropdown is opened
    useEffect(() => {
        if (!notificationDropdownOpen) return;
        const fetchUnread = async () => {
            try {
                const res = await axios.get('/auth/admin/fraud-logs/?status=pending&limit=10');
                const list = Array.isArray(res.data) ? res.data : (res.data.logs || []);
                setUnreadFraudLogs(list.filter(l => !l.reviewed));
            } catch { /* silent */ }
        };
        fetchUnread();
    }, [notificationDropdownOpen]);

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

    // Auto-refresh data and interval state
    const [refreshTrigger, setRefreshTrigger] = useState(false);
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(10); // 0 = off, 10, 30, 60 seconds

    useEffect(() => {
        if (autoRefreshInterval === 0) return; // Disabled

        const interval = setInterval(() => {
            if (activeTab === 'dashboard' || activeTab === 'fraud' || activeTab === 'audit') {
                setRefreshTrigger(prev => !prev);
            }
        }, autoRefreshInterval * 1000);

        return () => clearInterval(interval);
    }, [activeTab, autoRefreshInterval]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (activeTab === 'dashboard') {
                    // SWR: Load from cache first
                    const cachedData = sessionStorage.getItem('adminDashboardData');
                    if (cachedData && loading) {
                        try {
                            const parsed = JSON.parse(cachedData);
                            setStats(parsed.stats);
                            setRecentFraudLogs(parsed.recentFraudLogs);
                            setBoothStatuses(parsed.boothStatuses);
                            setLoading(false);
                        } catch (e) {
                            console.error("Cache parse error", e);
                        }
                    }

                    const [statsRes, fraudRes, opsRes] = await Promise.all([
                        axios.get('/auth/admin/stats/'),
                        axios.get('/auth/admin/fraud-logs/'), // recent logs
                        axios.get('/auth/admin/operators/')
                    ]);

                    setStats(statsRes.data);
                    // Handle paginated response (obj.logs) or flat list (array)
                    const fraudList = Array.isArray(fraudRes.data) ? fraudRes.data : (fraudRes.data.logs || []);
                    const slicedFraud = fraudList.slice(0, 5);
                    const slicedOps = opsRes.data.slice(0, 4);

                    setRecentFraudLogs(slicedFraud);
                    setBoothStatuses(slicedOps);

                    sessionStorage.setItem('adminDashboardData', JSON.stringify({
                        stats: statsRes.data,
                        recentFraudLogs: slicedFraud,
                        boothStatuses: slicedOps
                    }));
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [activeTab, refreshTrigger]);

    // Visual cue for refresh
    const [isRefreshing, setIsRefreshing] = useState(false);
    useEffect(() => {
        if (refreshTrigger) {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 800);
        }
    }, [refreshTrigger]);

    // Separate effect for Chart to avoid reloading everything
    useEffect(() => {
        const fetchChart = async () => {
            if (activeTab !== 'dashboard') return;
            try {
                const chartRes = await axios.get(`/auth/admin/voter-stats-chart/?period=${chartPeriod}`);
                setChartStats(chartRes.data);
            } catch (err) {
                console.error("Chart fetch error", err);
            }
        };
        fetchChart();
    }, [activeTab, chartPeriod, refreshTrigger]);




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

    const [showExportModal, setShowExportModal] = useState(false);
    const [showReportDropdown, setShowReportDropdown] = useState(false);
    const [exportConfig, setExportConfig] = useState({
        startDate: '',
        endDate: '',
        reportType: 'full',
    });
    const [exporting, setExporting] = useState(false);

    const reportOptions = [
        { value: 'full', label: 'Full Report (Verifications + Fraud + Audit)' },
        { value: 'fraud', label: 'Fraud Incidents Only' },
        { value: 'audit', label: 'Audit Logs Only' },
        { value: 'operators', label: 'Operator Summary Only' },
        { value: 'verifications', label: 'Verifications Only' }
    ];

    const handleExport = async () => {
        setExporting(true);
        try {
            const params = new URLSearchParams();
            if (exportConfig.startDate) params.append('start_date', exportConfig.startDate);
            if (exportConfig.endDate) params.append('end_date', exportConfig.endDate);
            if (exportConfig.reportType !== 'full') params.append('report_type', exportConfig.reportType);
            params.append('limit', '10000'); // Export all records

            const response = await axios.get(`/auth/admin/export-report/?${params.toString()}`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const dateStr = exportConfig.startDate && exportConfig.endDate
                ? `${exportConfig.startDate}_to_${exportConfig.endDate}`
                : new Date().toISOString().split('T')[0];
            link.setAttribute('download', `janmat_report_${exportConfig.reportType}_${dateStr}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            setShowExportModal(false);
        } catch (error) {
            console.error('Export failed', error);
            alert('Failed to export report. Please try again.');
        } finally {
            setExporting(false);
        }
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
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <SkeletonLoader type="stat" count={4} />
                            </div>
                        ) : (
                            <>
                                {/* Stats Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label={t('stats_total_verifications')} value={stats.verifications_today} icon={<Activity className="w-5 h-5" />} trend="All Time" color="blue" />

                                    <StatCard
                                        label={t('stats_total_verifications')}
                                        value={stats.verified_voters}
                                        icon={<Home className="w-5 h-5" />}
                                        subtext="of Total Voters"
                                        color="slate"
                                        progress={stats.total_voters ? (stats.verified_voters / stats.total_voters) * 100 : 0}
                                    />

                                    <StatCard
                                        label={t('stats_fraud_alerts')}
                                        value={stats.total_fraud_alerts}
                                        icon={<AlertOctagon className="w-5 h-5" />}
                                        subtext="Requires Review"
                                        color="red"
                                        onClick={() => setActiveTab('fraud')}
                                    />

                                    <StatCard
                                        label={t('nav_operators')}
                                        value={stats.total_operators}
                                        icon={<Users className="w-5 h-5" />}
                                        subtext={`${stats.active_operators || 0} ${t('status_active')}`}
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

                                    {/* Booth Status System */}
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm dark:bg-slate-800 dark:border-slate-700 flex flex-col h-full">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                                                Booth Status
                                            </h3>
                                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full dark:bg-slate-700 dark:text-slate-300">
                                                {boothStatuses.length} Live
                                            </span>
                                        </div>

                                        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
                                            {boothStatuses.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                                                    <MapPin className="w-8 h-8 mb-2 opacity-20" />
                                                    <p className="text-sm">No active booths.</p>
                                                </div>
                                            ) : (
                                                boothStatuses.map((op, idx) => (
                                                    <div key={idx} className="group flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-janmat-blue/30 hover:bg-slate-50 transition-all dark:border-slate-700 dark:hover:border-janmat-light/30 dark:hover:bg-slate-700/50">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-2 h-2 rounded-full ${op.is_active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 text-sm dark:text-slate-200 group-hover:text-janmat-blue dark:group-hover:text-janmat-light transition-colors">
                                                                    {op.booth_id || '??'}
                                                                </p>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                                                                    {op.full_name || op.name || 'Unknown'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className={`text-[10px] font-bold px-2 py-0.5 rounded ${op.is_active ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                                            {op.is_active ? 'ONLINE' : 'OFFLINE'}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        <button onClick={() => setActiveTab('operators')} className="w-full text-center text-xs font-bold text-janmat-blue hover:text-janmat-hover mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 dark:text-janmat-light transition-colors">
                                            View all booths
                                        </button>
                                    </div>
                                </div>

                                {/* Recent Fraud Logs */}
                                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6 dark:bg-slate-800 dark:border-slate-700">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg dark:text-white">{t('recent_fraud_alerts')}</h3>
                                        <div className="flex gap-2">
                                            <button onClick={() => setActiveTab('fraud')} className="px-3 py-1 bg-janmat-blue text-white rounded text-xs font-bold hover:bg-janmat-hover">{t('view_all_alerts')}</button>
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
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                                    {t('nav_' + activeTab) || (activeTab.charAt(0).toUpperCase() + activeTab.slice(1))}
                                </h2>

                                {/* Live Indicator & Refresh Controls */}
                                {(activeTab === 'dashboard' || activeTab === 'fraud' || activeTab === 'audit') && (
                                    <div className="flex items-center bg-slate-100 rounded-full border border-slate-200 p-0.5 dark:bg-slate-800 dark:border-slate-700">
                                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${autoRefreshInterval > 0 ? 'bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' : 'text-slate-500'}`}>
                                            {autoRefreshInterval > 0 && (
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                </span>
                                            )}
                                            {autoRefreshInterval > 0 ? 'Live' : 'Paused'}
                                        </div>

                                        <div className="flex items-center border-l border-slate-300 pl-1 ml-1 dark:border-slate-600">
                                            <button
                                                onClick={() => setAutoRefreshInterval(0)}
                                                className={`p-1.5 rounded-full transition-colors ${autoRefreshInterval === 0 ? 'bg-white shadow-sm text-slate-800 dark:bg-slate-700 dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                                                title="Pause Auto-Refresh"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => setAutoRefreshInterval(10)}
                                                className={`p-1.5 rounded-full transition-colors ${autoRefreshInterval === 10 ? 'bg-white shadow-sm text-green-600 dark:bg-slate-700 dark:text-green-400' : 'text-slate-400 hover:text-green-600 dark:hover:text-green-400'}`}
                                                title="Refresh Every 10s"
                                            >
                                                <span className="text-[10px] font-black">10s</span>
                                            </button>
                                            <button
                                                onClick={() => setAutoRefreshInterval(30)}
                                                className={`p-1.5 pr-2.5 rounded-full transition-colors ${autoRefreshInterval === 30 ? 'bg-white shadow-sm text-green-600 dark:bg-slate-700 dark:text-green-400' : 'text-slate-400 hover:text-green-600 dark:hover:text-green-400'}`}
                                                title="Refresh Every 30s"
                                            >
                                                <span className="text-[10px] font-black">30s</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs md:text-sm text-slate-500 mt-1 hidden sm:block dark:text-slate-400">Server time: <span className="font-mono">{currentTime}</span></p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-center">
                        {/* Audit Trail - Last Login */}
                        <div className="hidden md:flex flex-col items-end mr-2">
                            <span className="text-[10px] text-slate-400 font-medium dark:text-slate-500">Last Login</span>
                            <span className="text-xs text-slate-600 font-semibold dark:text-slate-300">
                                {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Just now'}
                            </span>
                        </div>

                        {/* Bell Icon for Notifications */}
                        <div className="relative" ref={notificationRef}>
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
                                        {unreadFraudLogs.length === 0 ? (
                                            <p className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">No new alerts. All caught up! ✅</p>
                                        ) : (
                                            unreadFraudLogs.slice(0, 8).map((log, i) => (
                                                <div key={i} className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:hover:bg-slate-700" onClick={() => { setActiveTab('fraud'); setNotificationDropdownOpen(false); }}>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">{log.fraud_type?.replace(/_/g, ' ')}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1 flex justify-between dark:text-slate-400">
                                                        <span>Booth: {log.booth_number}</span>
                                                        <span>{new Date(log.flagged_at).toLocaleString()}</span>
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

                        <LanguageSwitcher />

                        <button onClick={() => setShowExportModal(true)} className="flex items-center gap-2 px-3 py-2 md:px-4 bg-white border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600">
                            <Download className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                            <span className="hidden sm:inline">Export Report</span>
                        </button>
                    </div>
                </header>

                {/* Main Scrollable Area */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    <Breadcrumbs />
                    {renderContent()}
                </main>
            </div>

            {/* Export Report Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowExportModal(false)}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700">
                        {/* Header */}
                        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-700">
                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Download className="w-4 h-4 text-janmat-blue" /> Export Report
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">Customize your export options</p>
                            </div>
                            <button onClick={() => setShowExportModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded dark:hover:text-slate-200">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 space-y-4">
                            {/* Date Range */}
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Date Range</label>
                                <div className="grid grid-cols-2 gap-3 relative z-50">
                                    <CustomDatePicker
                                        label="From"
                                        value={exportConfig.startDate}
                                        onChange={(date) => setExportConfig(c => ({ ...c, startDate: date }))}
                                        placeholder="Start date"
                                    />
                                    <CustomDatePicker
                                        label="To"
                                        value={exportConfig.endDate}
                                        minDate={exportConfig.startDate}
                                        onChange={(date) => setExportConfig(c => ({ ...c, endDate: date }))}
                                        placeholder="End date"
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2">Leave blank to export all records</p>
                            </div>

                            {/* Report Type */}
                            <div className="relative z-40">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">Report Type</label>
                                <button
                                    type="button"
                                    onClick={() => setShowReportDropdown(!showReportDropdown)}
                                    className="w-full flex items-center justify-between px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:ring-2 focus:ring-janmat-blue outline-none transition-colors hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600"
                                >
                                    <span className="font-medium">{reportOptions.find(o => o.value === exportConfig.reportType)?.label}</span>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showReportDropdown ? 'rotate-180 text-janmat-blue' : ''}`} />
                                </button>

                                {showReportDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowReportDropdown(false)}></div>
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50">
                                            {reportOptions.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => { setExportConfig(c => ({ ...c, reportType: opt.value })); setShowReportDropdown(false); }}
                                                    className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 ${exportConfig.reportType === opt.value ? 'bg-blue-50/50 text-janmat-blue dark:bg-janmat-blue/10 dark:text-janmat-light' : 'text-slate-700 dark:text-slate-200'}`}
                                                >
                                                    <span className={`${exportConfig.reportType === opt.value ? 'font-bold' : 'font-medium'}`}>{opt.label}</span>
                                                    {exportConfig.reportType === opt.value && <Check className="w-4 h-4 text-janmat-blue dark:text-janmat-light" />}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-5 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
                            <button onClick={() => setShowExportModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors dark:text-slate-400 dark:hover:bg-slate-700">
                                Cancel
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={exporting}
                                className="px-5 py-2 bg-janmat-blue text-white rounded-lg text-sm font-bold hover:bg-janmat-hover transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {exporting ? (
                                    <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                                ) : (
                                    <><Download className="w-4 h-4" /> Download PDF</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Sub-components
// Sub-components
const StatCard = ({ label, value, icon, subtext, color, onClick, progress }) => {
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

