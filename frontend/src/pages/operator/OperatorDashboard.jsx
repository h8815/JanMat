import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';
import {
    LogOut, Shield, AlertTriangle,
    User, Clock, MapPin, CheckCircle2, FileWarning,
    Activity, Fingerprint
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import FontSizeSwitcher from '../../components/common/FontSizeSwitcher';
import SystemStatus from '../../components/common/SystemStatus';
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
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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
        <div className="min-h-screen bg-[#f4f6fa]">
            {/* Tricolor bar */}
            <div className="h-1.5 w-full flex">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-[#138808]" />
            </div>

            {/* Header */}
            <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-30">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img
                            src="/assets/images/ashoka-black.png"
                            alt="Emblem"
                            className="w-9 h-9 object-contain"
                            onError={(e) => { e.target.src = 'https://placehold.co/36x36?text=🏛️'; }}
                        />
                        <div className="border-l border-slate-200 pl-3">
                            <h1 className="text-sm font-bold text-slate-800 leading-tight tracking-tight uppercase">
                                {t('JanMat')} — {t('operator_console')}
                            </h1>
                            <p className="text-[10px] items-center text-slate-500 font-semibold tracking-wider leading-tight">
                                {t('ECI')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-xs flex-wrap justify-end">
                        <span className="hidden sm:block"><SystemStatus biometricStatus="Ready" /></span>
                        <span className="hidden sm:block"><FontSizeSwitcher /></span>
                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                        <LanguageSwitcher />
                        <span className="hidden sm:inline text-slate-700 font-bold font-mono tracking-widest">{currentTime}</span>
                        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                        <button
                            onClick={() => setShowLogoutConfirm(true)}
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

                {/* Operator Identity Banner — Dark Slate */}
                <div className="bg-[#1e293b] rounded-xl border border-slate-700 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] mb-5 relative overflow-hidden">
                    {/* Decorative blobs */}
                    <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-slate-600 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>
                    <div className="absolute -bottom-8 right-20 w-32 h-32 bg-slate-500 rounded-full mix-blend-multiply filter blur-2xl opacity-50"></div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-600 flex items-center justify-center shadow-inner">
                                <User className="w-7 h-7 text-slate-300" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight">{operatorName}</h2>
                                <div className="flex items-center gap-4 text-xs text-slate-300 font-medium mt-1.5 uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-slate-500" /> Booth {boothId}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-3.5 h-3.5 text-slate-500" /> {currentDate}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-2 px-4 py-2 rounded border-2 text-[10px] font-bold uppercase tracking-widest shadow-inner ${boothOpen
                                ? 'bg-slate-900 border-green-500/50 text-green-400'
                                : 'bg-slate-900 border-amber-500/50 text-amber-400'
                                }`}>
                                <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${boothOpen ? 'bg-green-500 animate-pulse' : 'bg-amber-400'}`} />
                                {boothOpen ? t('booth_active') : t('booth_closed')}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                    {/* LEFT: 2 cols */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Booth Control */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-start gap-4 mb-5">
                                <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                    <Activity className="w-6 h-6 text-slate-800" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-lg tracking-tight">
                                        {t('booth_control_title')}
                                    </h3>
                                    <p className="text-sm font-medium text-slate-700 mt-1">
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
                                    className="w-full sm:w-auto px-8 py-3.5 bg-janmat-blue text-white font-bold tracking-wide rounded-lg hover:bg-janmat-hover transition-all text-sm flex items-center justify-center gap-2 shadow-[0_4px_0_rgb(29,78,216)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(29,78,216)] active:translate-y-[4px] active:shadow-none border border-blue-500 uppercase"
                                >
                                    {t('btn_open_booth')}
                                </button>
                            ) : (
                                <div className="flex flex-wrap gap-4">
                                    <button
                                        onClick={() => navigate('/operator/verify')}
                                        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-green-600 text-white font-bold tracking-wide rounded-lg hover:bg-green-700 transition-all text-sm shadow-[0_4px_0_rgb(21,128,61)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(21,128,61)] active:translate-y-[4px] active:shadow-none border border-green-500 uppercase"
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
                                        className="px-6 py-4 bg-white text-red-600 font-bold tracking-wide rounded-lg hover:bg-red-50 transition-all text-sm shadow-[0_4px_0_rgb(252,165,165)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(252,165,165)] active:translate-y-[4px] active:shadow-none border border-red-200 uppercase"
                                    >
                                        {t('btn_close_booth')}
                                    </button>
                                </div>
                            )}
                        </div>


                        {/* Today's Activity (Moved Left & Horizontal) */}
                        {loading ? (
                            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                                <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-wider">{t('todays_activity')}</h3>
                                <SkeletonLoader type="text" count={3} />
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border-t-4 border-t-janmat-blue border-x border-b border-slate-200 p-6 shadow-sm relative overflow-hidden">
                                <Activity className="absolute -right-6 -bottom-6 w-32 h-32 text-slate-50 opacity-50 pointer-events-none" />
                                <h3 className="font-bold text-slate-800 text-sm mb-6 uppercase tracking-widest relative z-10">{t('todays_activity')}</h3>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative z-10">
                                    <div className="flex flex-col group p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-green-200 hover:bg-green-50/30 transition-colors">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center group-hover:bg-green-200 transition-colors">
                                                <CheckCircle2 className="w-5 h-5 text-green-700" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('stat_verified')}</p>
                                                <p className="text-xs font-semibold text-slate-700 group-hover:text-green-800 transition-colors leading-none">Citizens</p>
                                            </div>
                                        </div>
                                        <span className="text-3xl font-black text-slate-800 tracking-tighter mt-auto">{stats.today_verifications}</span>
                                    </div>

                                    <div className="flex flex-col group p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-amber-200 hover:bg-amber-50/30 transition-colors">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center group-hover:bg-amber-200 transition-colors">
                                                <Clock className="w-5 h-5 text-amber-700" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('stat_pending')}</p>
                                                <p className="text-xs font-semibold text-slate-700 group-hover:text-amber-800 transition-colors leading-none">Review</p>
                                            </div>
                                        </div>
                                        <span className="text-3xl font-bold text-slate-700 tracking-tighter mt-auto">{stats.pending_fraud_alerts}</span>
                                    </div>

                                    <div className="flex flex-col group p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-red-200 hover:bg-red-50/30 transition-colors">
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                                                <AlertTriangle className="w-5 h-5 text-red-700" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{t('stat_fraud_flags')}</p>
                                                <p className="text-xs font-semibold text-slate-700 group-hover:text-red-800 transition-colors leading-none">Alerts</p>
                                            </div>
                                        </div>
                                        <span className="text-3xl font-bold text-red-600 tracking-tighter mt-auto">{stats.fraud_alerts_today}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: Recent Verifications */}
                    <div className="space-y-5">
                        {/* Recent Verifications */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="font-bold text-slate-800 text-sm mb-4 uppercase tracking-widest">{t('recent_verifications')}</h3>
                            {!stats.recent_verifications || stats.recent_verifications.length === 0 ? (
                                <EmptyState
                                    icon={Clock}
                                    title={t('no_recent_verifications') || 'No Recent Activity'}
                                    message={t('no_recent_verifications_desc') || 'Verifications performed during this session will appear here.'}
                                />
                            ) : (
                                <div className="space-y-3">
                                    {stats.recent_verifications.slice(0, 10).map((v, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                                                <span className="text-slate-800 font-bold font-mono tracking-widest text-sm">{v.aadhaar_masked || `XXXX-${i}`}</span>
                                            </div>
                                            <span className="text-slate-500 font-medium text-xs bg-white px-2 py-1 rounded shadow-sm border border-slate-100">{v.time || '—'}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        {boothOpen && (
                            <div className="grid grid-cols-1 gap-4">
                                <button
                                    onClick={() => navigate('/operator/report-fraud')}
                                    className="bg-white rounded-xl border-2 border-slate-200 p-5 shadow-sm hover:border-red-400 hover:bg-red-50/50 transition-all text-left group hover:-translate-y-1 hover:shadow-md"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center group-hover:bg-red-500 group-hover:text-white group-hover:border-red-600 transition-colors shadow-inner">
                                            <FileWarning className="w-6 h-6 text-red-600 group-hover:text-white transition-colors" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-red-700 transition-colors">{t('report_incident')}</h4>
                                            <p className="text-xs font-semibold text-slate-500 mt-0.5">{t('report_incident_desc')}</p>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    className="bg-white rounded-xl border-2 border-slate-200 p-5 shadow-sm hover:border-blue-400 hover:bg-blue-50/50 transition-all text-left group hover:-translate-y-1 hover:shadow-md"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-700 transition-colors shadow-inner">
                                            <Shield className="w-6 h-6 text-blue-700 group-hover:text-white transition-colors" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-sm tracking-tight group-hover:text-blue-700 transition-colors">{t('support')}</h4>
                                            <p className="text-xs font-semibold text-slate-500 mt-0.5">{t('support_desc')}</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        )}

                    </div>
                </div>

                {/* Security Footer */}
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2 text-[11px] text-slate-500">
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

            {/* Logout Confirmation Modal */}
            <ConfirmationModal
                isOpen={showLogoutConfirm}
                onClose={() => setShowLogoutConfirm(false)}
                onConfirm={logout}
                title={t('confirm_logout_title') || 'Sign Out'}
                message={t('confirm_logout_desc') || 'Are you sure you want to sign out? You will need to log in again to access the dashboard.'}
                confirmText={t('btn_logout') || 'Sign Out'}
                cancelText={t('cancel') || 'Cancel'}
                isDanger={true}
            />
        </div>
    );
};

export default OperatorDashboard;
