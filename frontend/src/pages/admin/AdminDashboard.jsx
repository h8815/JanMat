import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import {
    Users, Home, AlertOctagon, FileText, Download, TrendingUp, Activity, BarChart3, LogOut, MapPin
} from 'lucide-react';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// Import components
import OperatorList from '../../components/admin/OperatorList';
import FraudLogTable from '../../components/admin/FraudLogTable';
import Settings from '../../components/admin/Settings';

// Placeholder for Audit
const AuditLogTable = () => (
    <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-700">Audit Logs</h3>
        <p className="text-slate-500">System-wide audit trail is safe in database. UI view coming soon.</p>
    </div>
);

const AdminDashboard = () => {
    const { user, logout } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleString());
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        verified_voters: 0,
        total_operators: 0,
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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, fraudRes, opsRes] = await Promise.all([
                    axios.get('/auth/admin/stats/'),
                    axios.get('/auth/admin/fraud-logs/'),
                    axios.get('/auth/admin/operators/')
                ]);
                
                setStats(statsRes.data);
                setRecentFraudLogs(fraudRes.data.slice(0, 5)); // Top 5
                setBoothStatuses(opsRes.data.slice(0, 4)); // Top 4 for sidebar
                
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        };

        if (activeTab === 'dashboard') {
            fetchData();
        }
    }, [activeTab]);

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

    // ... (Charts data)
    const chartData = {
        labels: ['10 AM', '11 AM', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM', '5 PM', '6 PM'],
        datasets: [
            {
                label: 'Verified Voters',
                data: [stats.verifications_today, 0, 0, 0, 0, 0, 0, 0, 0], // dynamic later
                borderColor: '#0B3D91',
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 200);
                    gradient.addColorStop(0, 'rgba(11, 61, 145, 0.4)');
                    gradient.addColorStop(1, 'rgba(11, 61, 145, 0.0)');
                    return gradient;
                },
                fill: true,
                tension: 0.4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true, grid: { borderDash: [5, 5] } },
            x: { grid: { display: false } }
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
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <StatCard label="Total Verified Today" value={stats.verifications_today} icon={<Activity className="w-5 h-5" />} trend="All Time" color="blue" />
                                    <StatCard label="Verified Voters" value={stats.verified_voters} icon={<Home className="w-5 h-5" />} subtext="Total Registered" color="slate" />
                                    <StatCard label="Fraud Alerts" value={stats.total_fraud_alerts} icon={<AlertOctagon className="w-5 h-5" />} subtext="Requires Review" color="red" />
                                    <StatCard label="Operators" value={stats.total_operators} icon={<Users className="w-5 h-5" />} subtext="Active Personnel" color="slate" />
                                </div>

                                {/* Graphs & Booths */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                <TrendingUp className="w-4 h-4" /> Verified Voters (per hour)
                                            </h3>
                                            <div className="flex gap-2">
                                                 <span className="px-2 py-1 bg-slate-900 text-white text-xs rounded font-bold">24h</span>
                                                 <span className="px-2 py-1 bg-white border text-slate-500 text-xs rounded hover:bg-slate-50 cursor-pointer">7d</span>
                                                 <span className="px-2 py-1 bg-white border text-slate-500 text-xs rounded hover:bg-slate-50 cursor-pointer">30d</span>
                                            </div>
                                        </div>
                                        <div className="h-64">
                                            <Line data={chartData} options={chartOptions} />
                                        </div>
                                    </div>

                                    {/* Booth Status System */}
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                                Booth Status
                                            </h3>
                                        </div>
                                        <div className="space-y-4">
                                            {boothStatuses.length === 0 ? (
                                                <p className="text-sm text-slate-500">No active booths.</p>
                                            ) : (
                                                boothStatuses.map((op, idx) => (
                                                    <div key={idx} className="flex justify-between items-center pb-3 border-b border-slate-50 last:border-0">
                                                        <div>
                                                            <p className="font-bold text-slate-800 text-sm">Booth {op.booth_id || '??'}</p>
                                                            <p className="text-xs text-slate-500">Operator: {op.name}</p>
                                                        </div>
                                                        <span className={`px-2 py-1 text-[10px] font-bold rounded-full ${op.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {op.is_active ? 'Active' : 'Offline'}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                            
                                            <button onClick={() => setActiveTab('operators')} className="w-full text-center text-xs font-bold text-janmat-blue hover:underline mt-2">
                                                View all booths
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Recent Fraud Logs */}
                                <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg">Recent Fraud Logs</h3>
                                        <div className="flex gap-2">
                                             <button className="px-3 py-1 border rounded text-xs text-slate-600 hover:bg-slate-50">Export CSV</button>
                                             <button onClick={() => setActiveTab('fraud')} className="px-3 py-1 bg-janmat-blue text-white rounded text-xs font-bold hover:bg-janmat-hover">View all fraud logs</button>
                                        </div>
                                    </div>
                                    
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="text-xs text-slate-400 uppercase border-b">
                                                <tr>
                                                    <th className="py-3 font-medium">Timestamp</th>
                                                    <th className="py-3 font-medium">Voter (Masked)</th>
                                                    <th className="py-3 font-medium">Booth ID</th>
                                                    <th className="py-3 font-medium">Violation</th>
                                                    <th className="py-3 font-medium">Status</th>
                                                    <th className="py-3 font-medium text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {recentFraudLogs.length === 0 ? (
                                                     <tr><td colSpan="6" className="py-4 text-center text-slate-500">No recent fraud alerts.</td></tr>
                                                ) : (
                                                    recentFraudLogs.map((log) => (
                                                        <tr key={log.id} className="hover:bg-slate-50">
                                                            <td className="py-3 text-slate-600 font-mono">{new Date(log.flagged_at).toLocaleString()}</td>
                                                            <td className="py-3 text-slate-900 font-medium">{log.aadhaar_masked || 'Unknown'}</td>
                                                            <td className="py-3 text-slate-600">{log.booth_number}</td>
                                                            <td className="py-3 text-slate-600">{log.fraud_type}</td>
                                                            <td className="py-3">
                                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${log.reviewed ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                                    {log.reviewed ? 'Reviewed' : 'Open'}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 text-right">
                                                                <button onClick={() => setActiveTab('fraud')} className="text-janmat-blue font-bold px-3 py-1 bg-slate-100 rounded hover:bg-slate-200">
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
        <div className="flex min-h-screen bg-slate-50 font-sans">
            {/* Sidebar */}
            <nav className="w-[260px] bg-white h-screen fixed border-r border-slate-200 flex flex-col z-50">
                <div className="p-6 flex items-center gap-3 mb-6">
                    <img src="/assets/images/ashoka.png" alt="Emblem" className="h-10 w-auto opacity-90" />
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">JanMat</h1>
                        <p className="text-xs text-slate-500">Admin Portal</p>
                    </div>
                </div>

                <div className="flex-1 space-y-1">
                    <NavItem icon={<Home className="w-5 h-5" />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
                    <NavItem icon={<Users className="w-5 h-5" />} label="Operators" active={activeTab === 'operators'} onClick={() => setActiveTab('operators')} />
                    <NavItem icon={<AlertOctagon className="w-5 h-5" />} label="Fraud Logs" active={activeTab === 'fraud'} onClick={() => setActiveTab('fraud')} />
                    <NavItem icon={<FileText className="w-5 h-5" />} label="Audit Logs" active={activeTab === 'audit'} onClick={() => setActiveTab('audit')} />
                    <NavItem icon={<Activity className="w-5 h-5" />} label="Settings" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </div>

                <div className="p-6 border-t border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
                            {user?.email?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        <div className="text-sm overflow-hidden">
                            <p className="font-bold text-slate-800 truncate">{user?.name || user?.email || 'Admin'}</p>
                            <p className="text-xs text-slate-500">Election Commission</p>
                        </div>
                    </div>
                    <button onClick={logout} className="w-full py-2 px-4 bg-red-50 text-red-600 text-sm font-medium rounded hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="ml-[260px] w-full p-8">
                {/* Top Header */}
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                            {activeTab === 'dashboard' && <span className="px-2 py-0.5 rounded text-[10px] bg-red-100 text-red-600 uppercase font-bold tracking-wider">Live</span>}
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">Server time: <span className="font-mono">{currentTime}</span></p>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors">
                            <Download className="w-4 h-4 text-slate-500" />
                            Export Report
                        </button>
                    </div>
                </header>

                {/* Dashboard View */}
                {renderContent()}
            </main>
        </div>
    );
};


// Sub-components
const NavItem = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`w-full px-6 py-3 flex items-center gap-3 text-sm font-medium transition-all ${active ? 'bg-janmat-blue text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}>
        {icon}
        {label}
    </button>
);

const StatCard = ({ label, value, icon, trend, subtext, color }) => {
    const borderClass = color === 'blue' ? 'border-janmat-blue' : color === 'red' ? 'border-red-500' : 'border-slate-200';
    const iconBg = color === 'blue' ? 'bg-blue-50 text-janmat-blue' : color === 'red' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600';
    return (
        <div className={`bg-white border text-left p-6 rounded-lg shadow-sm hover:shadow-md transition-all border-l-4 ${borderClass}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">{label}</p>
                    <h3 className={`text-3xl font-bold ${color === 'red' ? 'text-red-600' : 'text-slate-900'}`}>{value}</h3>
                </div>
                <span className={`p-2 rounded-lg ${iconBg}`}>{icon}</span>
            </div>
            {subtext && <p className={`text-xs mt-4 ${color === 'red' ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{subtext}</p>}
        </div>
    );
};

export default AdminDashboard;

