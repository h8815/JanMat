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
                            Secure Your Account
                        </h1>
                        <p className="mt-2 text-slate-200 text-sm">
                            For security reasons, you must establish a permanent password before accessing the JanMat portal.
                        </p>
                    </div>

                    {/* Right Side: Form */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-lg p-8 card-shadow border border-slate-200 max-w-xl mx-auto">
                            <form onSubmit={handleSubmit} noValidate>
                                <div className="flex items-center gap-3 mb-6">
                                    <ShieldCheck className="w-6 h-6 text-janmat-blue" />
                                    <h2 className="text-xl font-bold text-slate-800">Setup New Password</h2>
                                </div>

                                {/* Current Password */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700">Temporary Password</label>
                                    <div className="relative mt-2">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={tempPassword}
                                            onChange={(e) => setTempPassword(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none pr-10"
                                            placeholder="Enter initial password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>

                                {/* New Password */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-slate-700">
                                        New Password <span className="text-slate-500 font-normal ml-1">(Min 12 chars)</span>
                                    </label>
                                    <div className="relative mt-2">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={newPassword}
                                            onChange={handlePasswordChange}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none pr-10 tracking-wider"
                                            placeholder="Create strong password"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>

                                    {/* Password Strength Indicator */}
                                    {newPassword && (
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="flex gap-1.5 h-1.5 flex-1 max-w-[200px]">
                                                {[1, 2, 3, 4].map(num => (
                                                    <div
                                                        key={num}
                                                        className={`h-full flex-1 rounded-full transition-all duration-300 ${passwordScore >= num ? getStrengthColor(passwordScore) : 'bg-slate-200'}`}
                                                    ></div>
                                                ))}
                                            </div>
                                            <span className={`text-xs font-semibold ${getStrengthColor(passwordScore).replace('bg-', 'text-')}`}>
                                                {['Weak', 'Fair', 'Good', 'Strong'][passwordScore - 1] || 'Weak'}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Confirm Password */}
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-slate-700">Confirm New Password</label>
                                    <div className="relative mt-2">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none tracking-wider"
                                            placeholder="Match new password"
                                            required
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex gap-2 items-start">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || passwordScore < 2}
                                    className="w-full px-4 py-3 bg-janmat-blue text-white font-medium rounded-md hover:bg-janmat-hover focus:ring-2 focus:ring-offset-1 disabled:opacity-50 flex items-center justify-center gap-2 transition-all mt-4"
                                >
                                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                    <span>{loading ? 'Securing Environment...' : 'Set Password & Login'}</span>
                                </button>

                                <p className="mt-4 text-xs text-slate-500 text-center">
                                    Ensure your password contains uppercase letters, numbers, and special characters to meet the security policy.
                                </p>
                            </form>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default ForcePasswordChange;
