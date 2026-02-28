import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../../api/axios';
import { ROLES } from '../../constants/roles';

const ForcePasswordChange = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // In React 18 / Router 6, we pass state via the navigate function
    const { username } = location.state || {};

    const [tempPassword, setTempPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordScore, setPasswordScore] = useState(0);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        // Automatically kick out users who try to access this page directly without temporary credentials
        if (!username) {
            navigate('/login?role=operator');
        }
    }, [username, navigate]);

    // Password strength logic
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

    const handlePasswordChange = (e) => {
        const val = e.target.value;
        setNewPassword(val);
        setPasswordScore(calculateStrength(val));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 12) {
            setError('Password must be at least 12 characters long.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            const response = await api.post('/auth/setup-password/', {
                username,
                temp_password: tempPassword,
                new_password: newPassword
            });

            // Endpoint successfully set the new password and returned JWT tokens
            const { access, refresh, role } = response.data;

            // Set the tokens securely
            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            // Redirect them to their respective dashboard
            if (role === ROLES.ADMIN || role === ROLES.SUPERUSER) {
                window.location.href = '/admin-dashboard';
            } else {
                window.location.href = '/operator-dashboard';
            }

        } catch (err) {
            const backendMsg = err.response?.data?.error || err.response?.data?.details?.new_password?.[0];
            setError(backendMsg || 'Failed to update password. Please try again or contact IT.');
        } finally {
            setLoading(false);
        }
    };

    // Prevent rendering if missing state (it will redirect via useEffect)
    if (!username) return null;

    return (
        <div className="min-h-screen bg-tricolor flex flex-col items-center justify-center p-6 sm:p-12 font-sans overflow-hidden relative">

            {/* Elegant Header Graphic */}
            <div className="absolute top-0 left-0 w-full h-1/3 bg-gradient-to-b from-blue-900/90 to-transparent pointer-events-none"></div>

            <main className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out mt-8">

                {/* Clean, High-Contrast Solid Card */}
                <div className="bg-white rounded-2xl p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-slate-100 relative overflow-hidden">

                    <div className="text-center mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                            <ShieldCheck className="w-8 h-8 text-blue-600" strokeWidth={2} />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-2">Secure Your Account</h1>
                        <p className="text-slate-500 text-sm sm:text-base leading-relaxed">
                            For security reasons, you must establish a permanent password before accessing the JanMat portal.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">

                        {/* Current Password */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Current Password</label>
                            <div className="relative group">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={tempPassword}
                                    onChange={(e) => setTempPassword(e.target.value)}
                                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 text-lg placeholder-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none pr-12"
                                    placeholder="Enter initial password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* New Password */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">New Password <span className="text-slate-500 font-normal normal-case tracking-normal">(Min 12 keys)</span></label>
                            <div className="relative group flex flex-col">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={handlePasswordChange}
                                    className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 text-lg font-mono placeholder-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none pr-12"
                                    placeholder="Create strong password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>

                            {/* Password Strength Indicator */}
                            {newPassword && (
                                <div className="mt-4 flex items-center gap-3 animate-in fade-in duration-300 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <div className="flex gap-2 h-2.5 w-full max-w-[200px]">
                                        {[1, 2, 3, 4].map(num => (
                                            <div
                                                key={num}
                                                className={`h-full flex-1 rounded-full transition-all duration-500 ${passwordScore >= num ? getStrengthColor(passwordScore) : 'bg-slate-200'}`}
                                            ></div>
                                        ))}
                                    </div>
                                    <span className={`text-xs font-black uppercase tracking-wider ${getStrengthColor(passwordScore).replace('bg-', 'text-')}`}>
                                        {['Weak', 'Fair', 'Good', 'Strong'][passwordScore - 1] || 'Weak'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">Confirm New Password</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 text-lg font-mono placeholder-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                placeholder="Match new password"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-sm text-red-700 flex gap-3 items-start animate-in slide-in-from-top-2 font-medium">
                                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-500" />
                                <p className="leading-snug">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || passwordScore < 2}
                            className="w-full mt-4 px-6 py-4 bg-blue-600 text-white text-lg font-black tracking-wide uppercase rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 disabled:opacity-50 disabled:bg-slate-400 flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-500/25 mt-2"
                        >
                            {loading && <Loader2 className="w-6 h-6 animate-spin" />}
                            <span>{loading ? 'Securing Environment...' : 'Establish Secure Connection'}</span>
                        </button>

                    </form>
                </div>
            </main>
        </div>
    );
};

export default ForcePasswordChange;
