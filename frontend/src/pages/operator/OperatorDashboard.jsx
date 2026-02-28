import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import {
    LogOut, Lock, Shield, ArrowRight, AlertTriangle,
    User, Clock, MapPin, CheckCircle2, FileWarning,
    Activity, Fingerprint
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import Breadcrumbs from '../../components/common/Breadcrumbs';
import SkeletonLoader from '../../components/common/SkeletonLoader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmationModal from '../../components/common/ConfirmationModal';

const OperatorDashboard = () => {
    const { t } = useTranslation();
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        today_verifications: 0,
        total_verifications: 0,
        fraud_alerts_today: 0,
        pending_fraud_alerts: 0,
        booth_id: '—',
        recent_verifications: []
    });
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');
    const [boothOpen, setBoothOpen] = useState(false);

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        isDanger: false,
        onConfirm: () => { }
    });

    const updateClock = useCallback(() => {
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
        setCurrentDate(now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    }, []);

    const fetchStats = useCallback(async (isInitial = false) => {
        try {
            if (isInitial) {
                const cachedStats = sessionStorage.getItem('operatorDashStats');
                if (cachedStats) {
                    setStats(JSON.parse(cachedStats));
                    setLoading(false);
                }
            }

            const res = await axios.get('/auth/operator/stats/');
            setStats(res.data);
            sessionStorage.setItem('operatorDashStats', JSON.stringify(res.data));
        } catch (err) {
            console.error('Failed to fetch stats', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats(true);
        updateClock();
        const statsInterval = setInterval(() => fetchStats(false), 15000);
        const clockInterval = setInterval(updateClock, 1000);
        return () => { clearInterval(statsInterval); clearInterval(clockInterval); };
    }, [fetchStats, updateClock]);

    const boothId = stats.booth_id || user?.booth_id || '—';
    const operatorName = user?.full_name || user?.name || 'Operator';

    return (
        <div className="min-h-screen bg-[#f0f2f5]">
            {/* Tricolor bar */}
            <div className="h-1.5 w-full flex">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-[#138808]" />
            </div>

            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img
                            src="/assets/images/ashoka-black.png"
                            alt="Emblem"
                            className="w-9 h-9 object-contain"
                            onError={(e) => { e.target.src = 'https://placehold.co/36x36?text=🏛️'; }}
                        />
                        <div className="border-l border-slate-200 pl-3">
                            <h1 className="text-sm font-bold text-slate-800 leading-tight tracking-tight">
                                {t('JanMat')} — {t('operator_console')}
                            </h1>
                            <p className="text-[10px] text-slate-400 leading-tight">
                                {t('ECI')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <LanguageSwitcher />
                        <span className="hidden sm:inline text-slate-400 font-mono">{currentTime}</span>
                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                        <button
                            onClick={logout}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md font-semibold transition-colors"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            {t('logout')}
                        </button>
                    </div>
                </div>
            </header>
            {/* Main Content */}
            <main className="max-w-6xl mx-auto p-4 sm:p-6">
                <Breadcrumbs />

                {/* Operator Identity Banner */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm mb-5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-janmat-blue/10 flex items-center justify-center">
                                <User className="w-6 h-6 text-janmat-blue" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">{operatorName}</h2>
                                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> Booth {boothId}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" /> {currentDate}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${boothOpen
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : 'bg-amber-100 text-amber-700 border border-amber-200'
                                }`}>
                                <span className={`w-2 h-2 rounded-full ${boothOpen ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
                                {boothOpen ? t('booth_active') : t('booth_closed')}
                            </span>
                        </div>
                    </div>
                </div>

                {/* LIVE STATS TICKER */}
                <div className="bg-slate-800 rounded-xl p-3 mb-5 shadow-sm text-white flex flex-col sm:flex-row sm:items-center justify-between overflow-hidden relative gap-3 sm:gap-0">
                    {/* Subtle pulsing background effect */}
                    <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-green-500/20 to-transparent animate-pulse pointer-events-none"></div>

                    <div className="flex items-center gap-3 z-10 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-600 bg-slate-700/50 text-[10px] font-bold tracking-wider uppercase text-green-400">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Live System
                        </div>
                        <div className="h-4 w-px bg-slate-600 hidden sm:block"></div>
                        <div className="flex flex-col">
                            <span className="text-xs sm:text-sm text-slate-300 font-medium">Session Overview</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                                Login: {user?.last_login ? new Date(user.last_login).toLocaleTimeString() : 'Just now'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 sm:gap-6 z-10 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                        <div className="flex flex-col items-start sm:items-end sm:flex-row sm:items-center gap-1 sm:gap-2 whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Target</span>
                            <span className="text-lg font-bold text-slate-300 font-mono">~300</span>
                        </div>
                        <div className="h-6 w-px bg-slate-700"></div>
                        <div className="flex flex-col items-start sm:items-end sm:flex-row sm:items-center gap-1 sm:gap-2 whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Verified Today</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold text-white font-mono">{stats.today_verifications || 0}</span>
                                <span className="text-[10px] text-green-400 font-bold">↑</span>
                            </div>
                        </div>
                        <div className="h-6 w-px bg-slate-700"></div>
                        <div className="flex flex-col items-start sm:items-end sm:flex-row sm:items-center gap-1 sm:gap-2 whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">Fraud Blocked</span>
                            <span className={`text-lg font-bold font-mono ${stats.fraud_alerts_today > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                                {stats.fraud_alerts_today || 0}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* LEFT: 2 cols */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Booth Control */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-start gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                    <Activity className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base">
                                        {t('booth_control_title')}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-0.5">
                                        {!boothOpen
                                            ? t('booth_control_desc_closed')
                                            : t('booth_control_desc_active')
                                        }
                                    </p>
                                </div>
                            </div>
                            {!boothOpen ? (
                                <button
                                    onClick={() => setBoothOpen(true)}
                                    className="w-full sm:w-auto px-6 py-3 bg-janmat-blue text-white font-bold rounded-lg hover:bg-janmat-hover transition-all text-sm shadow-sm"
                                >
                                    {t('btn_open_booth')}
                                </button>
                            ) : (
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() => navigate('/operator/verify')}
                                        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-all text-sm shadow-sm"
                                    >
                                        <Fingerprint className="w-5 h-5" />
                                        {t('btn_start_verification')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setConfirmModal({
                                                isOpen: true,
                                                title: t('confirm_close_booth_title') || 'Close Booth',
                                                message: t('confirm_close_booth_desc') || 'Are you sure you want to close this booth? This will pause all verifications.',
                                                isDanger: true,
                                                onConfirm: () => setBoothOpen(false)
                                            });
                                        }}
                                        className="px-5 py-3.5 border border-red-300 text-red-600 font-semibold rounded-lg hover:bg-red-50 transition-all text-sm"
                                    >
                                        {t('btn_close_booth')}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        {boothOpen && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <button
                                    onClick={() => navigate('/operator/report-fraud')}
                                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:border-red-300 hover:bg-red-50/50 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                            <FileWarning className="w-5 h-5 text-red-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{t('report_incident')}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">{t('report_incident_desc')}</p>
                                        </div>
                                    </div>
                                </button>
                                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm text-left">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                            <Shield className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm">{t('support')}</h4>
                                            <p className="text-xs text-slate-500 mt-0.5">{t('support_desc')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Stats */}
                    <div className="space-y-5">
                        {loading ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                                <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider">{t('todays_activity')}</h3>
                                <SkeletonLoader type="text" count={3} />
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                                <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider">{t('todays_activity')}</h3>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                            </div>
                                            <span className="text-sm text-slate-600">{t('stat_verified')}</span>
                                        </div>
                                        <span className="text-2xl font-bold text-slate-800">{stats.today_verifications}</span>
                                    </div>
                                    <div className="h-px bg-slate-100" />
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                                <Clock className="w-4 h-4 text-amber-600" />
                                            </div>
                                            <span className="text-sm text-slate-600">{t('stat_pending')}</span>
                                        </div>
                                        <span className="text-2xl font-bold text-slate-800">{stats.pending_fraud_alerts}</span>
                                    </div>
                                    <div className="h-px bg-slate-100" />
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                            </div>
                                            <span className="text-sm text-slate-600">{t('stat_fraud_flags')}</span>
                                        </div>
                                        <span className="text-2xl font-bold text-red-600">{stats.fraud_alerts_today}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Recent Activity */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                            <h3 className="font-bold text-slate-800 text-sm mb-3 uppercase tracking-wider">{t('recent_verifications')}</h3>
                            {!stats.recent_verifications || stats.recent_verifications.length === 0 ? (
                                <EmptyState
                                    icon={Clock}
                                    title={t('no_recent_verifications') || 'No Recent Activity'}
                                    message={t('no_recent_verifications_desc') || 'Verifications performed during this session will appear here.'}
                                />
                            ) : (
                                <div className="space-y-2.5">
                                    {stats.recent_verifications.slice(0, 4).map((v, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                                            <span className="text-slate-600 font-medium">{v.aadhaar_masked || `XXXX-${i}`}</span>
                                            <span className="text-slate-400 font-mono">{v.time || '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Security Footer */}
                <div className="mt-8 pt-4 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-400">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('security_warning')}</span>
                </div>
            </main>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                title={confirmModal.title}
                message={confirmModal.message}
                isDanger={confirmModal.isDanger}
                onConfirm={confirmModal.onConfirm}
                confirmText={confirmModal.isDanger ? (t('btn_confirm') || 'Confirm') : (t('btn_confirm') || 'Confirm')}
                cancelText={t('btn_cancel') || 'Cancel'}
            />
        </div>
    );
};

export default OperatorDashboard;
