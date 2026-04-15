import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { ROLES } from '../../constants/roles';
import { useTranslation } from 'react-i18next';
import api from '../../api/axios';

const Login = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    const roleParam = searchParams.get('role');
    const role = roleParam === 'operator' ? ROLES.OPERATOR : ROLES.ADMIN;

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

    // Forgot password states
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [forgotUsername, setForgotUsername] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotMessage, setForgotMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        const reason = sessionStorage.getItem('logoutReason');
        if (reason) {
            setError(reason);
            sessionStorage.removeItem('logoutReason');
        }
    }, [role]);

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setForgotMessage({ type: '', text: '' });
        setForgotLoading(true);

        try {
            const res = await api.post('/auth/forgot-password/', { username: forgotUsername });
            setForgotMessage({ type: 'success', text: res.data.message });
        } catch (err) {
            setForgotMessage({ type: 'error', text: err.response?.data?.error || t('error_loading') });
        } finally {
            setForgotLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = role === ROLES.ADMIN ? '/auth/admin/login/' : '/auth/operator/login/';

            const result = await login(username, password, endpoint, role);

            if (result && result.requiresPasswordReset) {
                navigate('/setup-password', {
                    state: {
                        username: result.username
                    }
                });
                return;
            }

            if (role === ROLES.ADMIN) {
                navigate('/admin-dashboard');
            } else {
                navigate('/operator-dashboard');
            }
        } catch (err) {
            const backendMsg = err.response?.data?.error;
            setError(backendMsg || err.message || t('login_invalid_creds'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative font-sans overflow-x-hidden overflow-y-auto bg-slate-950 flex flex-col justify-center">
            {/* Cinematic Background */}
            <div className="fixed inset-0 bg-[url('/assets/images/indiaGate.webp')] bg-cover bg-center opacity-30"></div>
            <div className="fixed inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-transparent"></div>

            <main className="relative z-10 flex items-center justify-center p-4 md:p-8 w-full max-w-[1400px] mx-auto min-h-screen">
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center my-auto">

                    {/* Left Side: Branding & Asymmetrical Void */}
                    <div className="lg:col-span-5 md:pr-8 text-center lg:text-left pt-6 lg:pt-0">
                        <img
                            src="/assets/images/ashoka.webp"
                            alt="Ashoka Emblem"
                            className="mx-auto lg:mx-0 w-20 h-20 lg:w-28 lg:h-28 object-contain brightness-0 invert drop-shadow-md"
                            onError={(e) => { e.target.src = 'https://placehold.co/128x128?text=Emblem'; }}
                        />
                        <h1 className="mt-6 text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase leading-tight">
                            {role === ROLES.ADMIN ? t('admin_portal_title') : t('operator_login_title')}
                        </h1>
                        <p className="mt-3 text-slate-300 text-base font-medium leading-relaxed max-w-sm mx-auto lg:mx-0 lg:border-l-2 border-blue-500/50 lg:pl-4 py-1">
                            {role === ROLES.ADMIN
                                ? t('admin_login_desc')
                                : t('operator_login_desc')
                            }
                        </p>
                        <div className="mt-8 lg:mt-10">
                            <Link to="/" className="inline-flex px-5 py-2.5 text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all gap-2 items-center tracking-wide uppercase backdrop-blur-sm">
                                <span>←</span> {t('back_to_selection')}
                            </Link>
                        </div>
                    </div>

                    {/* Spacer for intentional asymmetry */}
                    <div className="hidden lg:block lg:col-span-1"></div>

                    {/* Right Side: Glassmorphic Form Workspace */}
                    <div className="lg:col-span-6 w-full max-w-[460px] mx-auto lg:mr-0">
                        <div className="bg-[#0b1326]/70 backdrop-blur-2xl rounded-2xl p-6 md:p-10 shadow-2xl border border-white/10 relative overflow-hidden">
                            {/* Inner ambient glow */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[80px] -z-10 translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

                            {isForgotPassword ? (
                                <form onSubmit={handleForgotPassword} noValidate className="relative z-10 space-y-5">
                                    <div>
                                        <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tight">{t('reset_password_title')}</h2>
                                        <p className="text-xs text-slate-400 font-medium leading-relaxed pr-8">{t('reset_password_desc')}</p>
                                    </div>

                                    <div>
                                        <label htmlFor="forgotUsername" className="block text-[11px] font-bold text-slate-300 mb-1.5 tracking-wider uppercase">{t('username_label')}</label>
                                        <input
                                            id="forgotUsername"
                                            type="text"
                                            required
                                            value={forgotUsername}
                                            onChange={(e) => setForgotUsername(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none transition-all placeholder:text-slate-500 text-white font-medium shadow-inner text-sm"
                                            placeholder={t('username_forgot_placeholder')}
                                        />
                                    </div>

                                    {forgotMessage.text && (
                                        <div className={`p-4 rounded-xl text-xs font-bold flex gap-3 items-start border backdrop-blur-md ${forgotMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
                                            {forgotMessage.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                                            <p>{forgotMessage.text}</p>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="w-full px-4 py-3.5 bg-gradient-to-r from-blue-700 to-indigo-900 border border-blue-500/30 text-white font-black rounded-xl hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all uppercase tracking-widest text-[11px]"
                                        >
                                            {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>{forgotLoading ? t('btn_sending') : t('btn_send_reset')}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsForgotPassword(false); setForgotMessage({ type: '', text: '' }); }}
                                            className="w-full px-4 py-3.5 bg-transparent border border-white/20 text-white font-bold rounded-xl hover:bg-white/5 focus:ring-4 focus:ring-white/10 disabled:opacity-50 flex items-center justify-center transition-all uppercase tracking-widest text-[11px]"
                                        >
                                            {t('btn_back_to_login')}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleSubmit} noValidate className="relative z-10 space-y-5">
                                    <div>
                                        <label htmlFor="username" className="block text-[11px] font-bold text-slate-300 mb-1.5 tracking-wider uppercase">
                                            {role === ROLES.OPERATOR ? t('operator_username_label') : t('admin_username_label')}
                                        </label>
                                        <input
                                            id="username"
                                            type="text"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none transition-all placeholder:text-slate-500 text-white font-medium shadow-inner text-sm"
                                            placeholder={role === ROLES.OPERATOR ? t('username_placeholder_operator') : t('username_placeholder_admin')}
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-end mb-1.5">
                                            <label htmlFor="password" className="block text-[11px] font-bold text-slate-300 tracking-wider uppercase">{t('password_label')}</label>
                                            <button
                                                type="button"
                                                onClick={() => { setIsForgotPassword(true); setForgotUsername(username); }}
                                                className="text-[10px] text-blue-400 font-bold hover:text-blue-300 transition-colors uppercase tracking-widest"
                                            >
                                                {t('forgot_password_link')}
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-400 outline-none transition-all pr-10 placeholder:text-slate-500 text-white font-medium shadow-inner text-sm"
                                                placeholder={t('password_placeholder')}
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

                                    <div>
                                        <label className="inline-flex items-center text-sm group cursor-pointer mt-1">
                                            <input type="checkbox" className="h-4 w-4 bg-white/10 border-white/20 rounded focus:ring-blue-500/50 cursor-pointer text-blue-600" />
                                            <span className="ml-3 text-slate-300 text-xs font-medium group-hover:text-white transition-colors">{t('remember_device')}</span>
                                        </label>
                                    </div>

                                    <div className="pt-2">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full px-4 py-3.5 bg-gradient-to-r from-blue-700 to-indigo-900 border border-blue-500/30 text-white font-black rounded-xl hover:shadow-[0_0_24px_rgba(37,99,235,0.4)] focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 flex items-center justify-center gap-2 transition-all uppercase tracking-[0.15em] text-[11px]"
                                        >
                                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>{loading ? t('signing_in') : t('sign_in')}</span>
                                        </button>
                                    </div>

                                    {error && (
                                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs font-bold text-red-300 flex gap-2 items-start animate-fade-in backdrop-blur-md">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                                            <p>{error}</p>
                                        </div>
                                    )}

                                    <div className="mt-6 pt-5 border-t border-white/10">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest text-center leading-relaxed">
                                            {t('login_restricted_note')}
                                        </p>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Login;
