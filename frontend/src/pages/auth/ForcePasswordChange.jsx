import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import api from '../../api/axios';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../../context/AuthContext';

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
            if (role === 'ADMIN' || role === 'SUPERUSER') {
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
                <div className="bg-white rounded-xl p-8 card-shadow border border-slate-200 w-full max-w-md animate-in fade-in zoom-in-95 duration-300">

                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                            <ShieldCheck className="w-8 h-8 text-janmat-blue" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">Secure Your Account</h1>
                        <p className="text-slate-500 text-sm mt-2">
                            For security reasons, you must change your temporary password before accessing the JanMat portal.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Current/Temporary Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={tempPassword}
                                    onChange={(e) => setTempPassword(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-janmat-blue outline-none pr-10"
                                    placeholder="Enter your initial password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={handlePasswordChange}
                                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-janmat-blue outline-none pr-10"
                                    placeholder="Enter 12+ characters"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>

                            {/* Password Strength Indicator */}
                            {newPassword && (
                                <div className="mt-2 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                                    <div className="flex gap-1 h-1.5 flex-1 max-w-[150px]">
                                        {[1, 2, 3, 4].map(num => (
                                            <div key={num} className={`h-full flex-1 rounded-sm transition-colors ${passwordScore >= num ? getStrengthColor(passwordScore) : 'bg-slate-200'}`}></div>
                                        ))}
                                    </div>
                                    <span className={`font-medium ${getStrengthColor(passwordScore).replace('bg-', 'text-')}`}>
                                        {['Weak', 'Fair', 'Good', 'Strong'][passwordScore - 1] || 'Weak'}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-janmat-blue outline-none"
                                placeholder="Match new password"
                                required
                            />
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded text-sm text-red-600 flex gap-2 items-start">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                <p>{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || passwordScore < 2} // Force at least 'Fair' severity
                            className="w-full mt-4 px-4 py-3 bg-janmat-blue text-white font-bold rounded-lg hover:bg-janmat-hover focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            <span>{loading ? 'Securing Account...' : 'Save & Continue'}</span>
                        </button>

                    </form>
                </div>
            </main>
        </div>
    );
};

export default ForcePasswordChange;
