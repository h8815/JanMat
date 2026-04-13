import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';
import { ROLES } from '../../constants/roles';

const ForcePasswordChange = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();

    const { username } = location.state || {};

    const [tempPassword, setTempPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordScore, setPasswordScore] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!username) {
            navigate('/login?role=operator');
        }
    }, [username, navigate]);

    const calculateStrength = (pwd) => {
        let score = 0;
        if (!pwd) return 0;
        if (pwd.length >= 12) score += 1;
        if (/[A-Z]/.test(pwd)) score += 1;
        if (/[0-9]/.test(pwd)) score += 1;
        if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
        return score;
    };

    const getStrengthColor = (score) => {
        if (score === 0) return 'bg-slate-200';
        if (score <= 1) return 'bg-red-500';
        if (score === 2) return 'bg-orange-500';
        if (score === 3) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getStrengthLabel = (score) => {
        if (score <= 1) return t('strength_weak');
        if (score === 2) return t('strength_fair');
        if (score === 3) return t('strength_good');
        return t('strength_strong');
    };

    const handlePasswordChange = (e) => {
        const val = e.target.value;
        setNewPassword(val);
        setPasswordScore(calculateStrength(val));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 12) {
            setError(t('password_too_short'));
            return;
        }

        if (newPassword !== confirmPassword) {
            setError(t('passwords_dont_match'));
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/auth/setup-password/', {
                username,
                temp_password: tempPassword,
                new_password: newPassword
            });

            const { access, refresh, role } = response.data;

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            if (role === ROLES.ADMIN || role === ROLES.SUPERUSER) {
                window.location.href = '/admin-dashboard';
            } else {
                window.location.href = '/operator-dashboard';
            }

        } catch (err) {
            const backendMsg = err.response?.data?.error || err.response?.data?.details?.new_password?.[0];
            setError(backendMsg || t('password_update_failed'));
        } finally {
            setLoading(false);
        }
    };

    if (!username) return null;

    return (
        <div className="min-h-screen relative font-sans overflow-x-hidden overflow-y-auto bg-slate-950 flex flex-col justify-center">
            {/* Cinematic Background */}
            <div className="fixed inset-0 bg-[url('/assets/images/indiaGate.png')] bg-cover bg-center opacity-30"></div>
            <div className="fixed inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-transparent"></div>

            <main className="relative z-10 flex items-center justify-center p-4 md:p-8 w-full max-w-[1400px] mx-auto min-h-screen">
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto">

                    {/* Left Side: Branding & Asymmetrical Void */}
                    <div className="lg:col-span-5 md:pr-8 text-center lg:text-left pt-6 lg:pt-0">
                        <img
                            src="/assets/images/ashoka.png"
                            alt="Ashoka Emblem"
                            className="mx-auto lg:mx-0 w-20 h-20 lg:w-28 lg:h-28 object-contain brightness-0 invert drop-shadow-md"
                            onError={(e) => { e.target.src = 'https://placehold.co/128x128?text=Emblem'; }}
                        />
                        <h1 className="mt-6 text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
                            {t('secure_account_title')}
                        </h1>
                        <p className="mt-3 text-slate-300 text-base font-medium leading-relaxed max-w-sm mx-auto lg:mx-0 lg:border-l-2 border-blue-500/50 lg:pl-4 py-1">
                            {t('secure_account_desc')}
                        </p>
                    </div>

                    {/* Spacer for intentional asymmetry */}
                    <div className="hidden lg:block lg:col-span-1"></div>

                    {/* Right Side: Glassmorphic Form Workspace */}
                    <div className="lg:col-span-6 w-full max-w-[460px] mx-auto lg:mr-0">
                        <div className="bg-[#0b1326]/70 backdrop-blur-2xl rounded-2xl p-6 md:p-10 shadow-2xl border border-white/10 relative overflow-hidden">
                            {/* Inner ambient glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

                            <form onSubmit={handleSubmit} noValidate className="relative z-10 space-y-5">
                                <div className="flex items-center gap-3 mb-2 border-b border-white/10 pb-4">
                                    <ShieldCheck className="w-6 h-6 text-blue-400" />
                                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">{t('setup_new_password_title')}</h2>
                                </div>

                                {/* Current Password */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5 tracking-wider uppercase">{t('temp_password_label')}</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={tempPassword}
                                            onChange={(e) => setTempPassword(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none transition-all pr-12 placeholder:text-slate-500 text-white font-medium shadow-inner tracking-wider text-sm"
                                            placeholder={t('temp_password_placeholder')}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5 tracking-wider uppercase">
                                        {t('new_password_label')} <span className="text-slate-500 font-bold ml-1">{t('new_password_req')}</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={handlePasswordChange}
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none transition-all pr-12 placeholder:text-slate-500 text-white font-medium shadow-inner tracking-wider text-sm"
                                            placeholder={t('new_password_placeholder')}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-white transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>

                                    {/* Password Strength Indicator */}
                                    {newPassword && (
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex gap-1.5 h-1.5 flex-1 max-w-[200px]">
                                                {[1, 2, 3, 4].map(num => (
                                                    <div
                                                        key={num}
                                                        className={`h-full flex-1 rounded-full transition-all duration-300 ${passwordScore >= num ? getStrengthColor(passwordScore) : 'bg-white/10'}`}
                                                    ></div>
                                                ))}
                                            </div>
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${passwordScore > 0 ? getStrengthColor(passwordScore).replace('bg-', 'text-') : 'text-slate-400'}`}>
                                                {getStrengthLabel(passwordScore)}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-300 mb-1.5 tracking-wider uppercase">{t('confirm_password_label')}</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none transition-all pr-12 placeholder:text-slate-500 text-white font-medium shadow-inner tracking-wider text-sm"
                                            placeholder={t('confirm_password_placeholder')}
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-300 flex gap-2 items-start animate-fade-in backdrop-blur-md">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading || passwordScore < 2}
                                        className="w-full px-4 py-3.5 bg-gradient-to-r from-blue-700 to-indigo-900 border border-blue-500/30 text-white font-black rounded-xl hover:shadow-[0_0_24px_rgba(37,99,235,0.4)] focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[11px]"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        <span>{loading ? t('btn_securing') : t('btn_set_password')}</span>
                                    </button>
                                </div>

                                <div className="mt-6 pt-5 border-t border-white/10">
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest text-center leading-relaxed">
                                        {t('password_policy_note')}
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default ForcePasswordChange;
