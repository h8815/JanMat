import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Loader2, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { ROLES } from '../../constants/roles';
import api from '../../api/axios';

const Login = () => {
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
            setForgotMessage({ type: 'error', text: err.response?.data?.error || 'Failed to request password reset.' });
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
                // Redirect to the password setup page and pass the username via React Router state
                navigate('/setup-password', {
                    state: {
                        username: result.username
                    }
                });
                return;
            }

            // Redirect based on role if login fully succeeds
            if (role === ROLES.ADMIN) {
                navigate('/admin-dashboard');
            } else {
                navigate('/operator-dashboard');
            }
        } catch (err) {
            // Prioritize backend error message (e.g., "Invalid credentials")
            const backendMsg = err.response?.data?.error;
            setError(backendMsg || err.message || 'Invalid credentials. Please contact support.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-tricolor relative">
            <div className="absolute inset-0 bg-black/55"></div>

            <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 items-center">

                    {/* Left Side: Branding */}
                    <div className="md:col-span-1 text-center md:text-left px-6">
                        <img
                            src="/assets/images/ashoka.png"
                            alt="Ashoka Emblem"
                            className="mx-auto md:mx-0 w-20 h-20 object-contain"
                            onError={(e) => { e.target.src = 'https://placehold.co/80x80?text=Emblem'; }}
                        />
                        <h1 className="mt-4 text-2xl font-semibold text-white">
                            {role === ROLES.ADMIN ? 'Admin Portal' : 'JanMat — Booth Operator Login'}
                        </h1>
                        <p className="mt-2 text-slate-200 max-w-sm">
                            {role === 'ADMIN'
                                ? 'Restricted access for Election Commission administrators. All access is logged and audited.'
                                : 'Authorized access only. All actions are logged.'
                            }
                        </p>
                        <Link to="/" className="inline-block mt-6 text-sm text-white underline">
                            Back to Role Selection
                        </Link>
                    </div>

                    {/* Right Side: Form */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-lg p-8 card-shadow border border-slate-200 max-w-xl mx-auto">
                            {isForgotPassword ? (
                                <form onSubmit={handleForgotPassword} noValidate>
                                    <h2 className="text-xl font-bold text-slate-800 mb-2">Reset Password</h2>
                                    <p className="text-sm text-slate-500 mb-6">Enter your email address and we'll send you a temporary password. You will be required to change it immediately after logging in.</p>

                                    <div className="mb-6">
                                        <label htmlFor="forgotUsername" className="block text-sm font-medium text-slate-700">Username</label>
                                        <input
                                            id="forgotUsername"
                                            type="text"
                                            required
                                            value={forgotUsername}
                                            onChange={(e) => setForgotUsername(e.target.value)}
                                            className="mt-2 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none"
                                            placeholder="Enter your username"
                                        />
                                    </div>

                                    {forgotMessage.text && (
                                        <div className={`mb-6 p-3 border rounded text-sm flex gap-2 items-start ${forgotMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                            {forgotMessage.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
                                            <p>{forgotMessage.text}</p>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3">
                                        <button
                                            type="submit"
                                            disabled={forgotLoading}
                                            className="w-full px-4 py-3 bg-janmat-blue text-white font-medium rounded-md hover:bg-janmat-hover focus:ring-2 focus:ring-offset-1 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {forgotLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>{forgotLoading ? 'Sending...' : 'Send Reset Instructions'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setIsForgotPassword(false); setForgotMessage({ type: '', text: '' }); }}
                                            className="w-full px-4 py-3 bg-white border border-slate-300 text-slate-700 font-medium rounded-md hover:bg-slate-50 focus:ring-2 focus:ring-offset-1 disabled:opacity-50 flex items-center justify-center"
                                        >
                                            Back to Login
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleSubmit} noValidate>
                                    <div className="mb-6">
                                        <label htmlFor="username" className="block text-sm font-medium text-slate-700">{role === ROLES.OPERATOR ? 'Operator Username' : 'Admin Username'}</label>
                                        <input
                                            id="username"
                                            type="text"
                                            required
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="mt-2 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none"
                                            placeholder={role === ROLES.OPERATOR ? 'operator@janmat.gov.in' : 'admin@janmat.gov.in'}
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                                        <div className="relative mt-2">
                                            <input
                                                id="password"
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none pr-10"
                                                placeholder="••••••••"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700"
                                            >
                                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mb-6">
                                        <label className="inline-flex items-center text-sm">
                                            <input type="checkbox" className="h-4 w-4 text-janmat-blue border-slate-300 rounded" />
                                            <span className="ml-2 text-slate-700">Remember this device</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => { setIsForgotPassword(true); setForgotUsername(username); }}
                                            className="text-sm text-janmat-blue hover:underline"
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>

                                    <div>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full px-4 py-3 bg-janmat-blue text-white font-medium rounded-md hover:bg-janmat-hover focus:ring-2 focus:ring-offset-1 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                                        </button>
                                    </div>

                                    {error && (
                                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex gap-2 items-start">
                                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                            <p>{error}</p>
                                        </div>
                                    )}

                                    <p className="mt-4 text-xs text-slate-500">
                                        Access is restricted to authorized Election Commission staff. All access is logged.
                                    </p>
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
