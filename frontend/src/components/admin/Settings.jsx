import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { Lock, Save, User, Edit2, X, AlertCircle, CheckCircle, Moon, Sun, Shield, Clock, Smartphone, Monitor } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from 'react-i18next';

const Settings = ({ user }) => {
    const { t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    // Password State
    const [passwordData, setPasswordData] = useState({
        old_password: '',
        new_password: '',
        confirm_password: ''
    });

    // Profile State
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState({
        name: '',
        email: ''
    });

    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    // Security Features State
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);

    // Mock Login Activity Data
    const loginHistory = [
        { id: 1, device: "Chrome on Windows", ip: "192.168.1.45", location: "New Delhi, India", time: "2 mins ago", current: true, type: 'desktop' },
        { id: 2, device: "Safari on iPhone", ip: "103.44.2.19", location: "Mumbai, India", time: "2 days ago", current: false, type: 'mobile' },
        { id: 3, device: "Chrome on macOS", ip: "45.112.55.1", location: "New Delhi, India", time: "1 week ago", current: false, type: 'desktop' }
    ];

    const checkPasswordStrength = (pwd) => {
        let score = 0;
        if (!pwd) return 0;
        if (pwd.length >= 8) score += 1;
        if (pwd.match(/[A-Z]/)) score += 1;
        if (pwd.match(/[0-9]/)) score += 1;
        if (pwd.match(/[^A-Za-z0-9]/)) score += 1;
        return score; // 0 to 4
    };

    const getStrengthColor = (score) => {
        if (score === 0) return 'bg-slate-200 dark:bg-slate-600';
        if (score === 1) return 'bg-red-500';
        if (score === 2) return 'bg-yellow-500';
        if (score === 3) return 'bg-blue-500';
        if (score === 4) return 'bg-green-500';
    };

    const passwordScore = checkPasswordStrength(passwordData.new_password);

    // Sync init data
    useEffect(() => {
        if (user) {
            setProfileData({
                name: user.name || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleProfileChange = (e) => {
        setProfileData({ ...profileData, [e.target.name]: e.target.value });
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (passwordData.new_password !== passwordData.confirm_password) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        setLoading(true);
        try {
            await axios.post('/auth/admin/change-password/', {
                old_password: passwordData.old_password,
                new_password: passwordData.new_password
            });
            setMessage({ type: 'success', text: 'Password updated successfully' });
            setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
        } catch (error) {
            let errorMsg = 'Failed to update password';
            if (error.response?.data) {
                if (error.response.data.details) {
                    // Format: "Key: [List of errors]"
                    // e.g. "new_password: Password must be at least 12 characters."
                    const details = error.response.data.details;
                    errorMsg = Object.entries(details)
                        .map(([key, val]) => {
                            const fieldName = key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return `${fieldName}: ${Array.isArray(val) ? val.join(' ') : val}`;
                        })
                        .join('\n');
                } else if (error.response.data.error) {
                    errorMsg = error.response.data.error;
                }
            }
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });
        setLoading(true);

        try {
            const response = await axios.put('/auth/admin/update-profile/', profileData);
            setMessage({ type: 'success', text: 'Profile updated successfully' });
            setIsEditing(false);
            // Ideally update global context here, but local state update is good for now
        } catch (error) {
            let errorMsg = 'Failed to update profile';
            if (error.response?.data) {
                if (error.response.data.details) {
                    const details = error.response.data.details;
                    errorMsg = Object.entries(details)
                        .map(([key, val]) => {
                            const fieldName = key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                            return `${fieldName}: ${Array.isArray(val) ? val.join(' ') : val}`;
                        })
                        .join('\n');
                } else if (error.response.data.error) {
                    errorMsg = error.response.data.error;
                }
            }
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {message.text && (
                <div className={`p-4 rounded flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    {message.text}
                </div>
            )}

            {/* Profile Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 relative dark:bg-slate-800 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                        <User className="w-5 h-5 text-janmat-blue dark:text-janmat-light" /> {t('profile_title')}
                    </h3>
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1 text-sm text-slate-500 hover:text-janmat-blue transition-colors dark:text-slate-400 dark:hover:text-janmat-light"
                        >
                            <Edit2 className="w-4 h-4" /> {t('btn_edit_profile')}
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsEditing(false)}
                            className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors dark:text-slate-400 dark:hover:text-red-400"
                        >
                            <X className="w-4 h-4" /> {t('cancel')}
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_name')}</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={profileData.name}
                                    onChange={handleProfileChange}
                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">
                                    {t('label_email_unique')}
                                </label>
                                <input
                                    type="email"
                                    name="email"
                                    value={profileData.email}
                                    onChange={handleProfileChange}
                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-janmat-blue text-white font-bold rounded hover:bg-janmat-hover disabled:opacity-50 transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" /> {t('save')}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">{t('label_name')}</label>
                            <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 font-bold dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                {profileData.name || 'Admin'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">{t('label_email')}</label>
                            <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300">
                                {profileData.email}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">{t('label_admin_id')}</label>
                            <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-500 font-mono text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400">
                                {user?.id || 'N/A'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">{t('label_role')}</label>
                            <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-janmat-blue font-bold tracking-wider dark:bg-slate-700 dark:border-slate-600 dark:text-janmat-light">
                                {user?.role || 'ADMIN'}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Password Change */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 dark:text-white">
                    <Lock className="w-5 h-5 text-janmat-blue dark:text-janmat-light" /> {t('change_password_title')}
                </h3>

                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_current_password')}</label>
                        <input
                            type="password"
                            name="old_password"
                            value={passwordData.old_password}
                            onChange={handlePasswordChange}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_new_password')}</label>
                        <input
                            type="password"
                            name="new_password"
                            value={passwordData.new_password}
                            onChange={handlePasswordChange}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            required
                        />
                        {passwordData.new_password && (
                            <div className="mt-2 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                                <div className="flex gap-1 h-1.5 flex-1 max-w-[150px]">
                                    {[1, 2, 3, 4].map(num => (
                                        <div key={num} className={`h-full flex-1 rounded-sm transition-colors ${passwordScore >= num ? getStrengthColor(passwordScore) : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                                    ))}
                                </div>
                                <span className={`font-medium ${getStrengthColor(passwordScore).replace('bg-', 'text-')}`}>
                                    {[t('pwd_strength_weak'), t('pwd_strength_fair'), t('pwd_strength_good'), t('pwd_strength_strong')][passwordScore - 1] || t('pwd_strength_weak')}
                                </span>
                            </div>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_confirm_password')}</label>
                        <input
                            type="password"
                            name="confirm_password"
                            value={passwordData.confirm_password}
                            onChange={handlePasswordChange}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white font-bold rounded hover:bg-slate-700 disabled:opacity-50 transition-colors dark:bg-slate-600 dark:hover:bg-slate-500"
                    >
                        <Save className="w-4 h-4" /> {t('btn_update_password')}
                    </button>
                    <p className="text-xs text-slate-500 mt-2 dark:text-slate-400">
                        {t('password_note')}
                    </p>
                </form>
            </div>

            {/* Appearance Settings */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 dark:text-white">
                    {theme === 'dark' ? <Moon className="w-5 h-5 text-janmat-blue dark:text-janmat-light" /> : <Sun className="w-5 h-5 text-janmat-blue" />}
                    {t('appearance_title')}
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-800 dark:text-white">{t('dark_mode')}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{t('dark_mode_desc')}</p>
                    </div>
                    <button
                        onClick={toggleTheme}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-janmat-blue focus:ring-offset-2 ${theme === 'dark' ? 'bg-janmat-blue' : 'bg-slate-200'}`}
                    >
                        <span
                            className={`${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                    </button>
                </div>
            </div>

            {/* Login Activity */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 dark:text-white">
                    <Clock className="w-5 h-5 text-janmat-blue dark:text-janmat-light" /> {t('login_activity_title') || 'Login Activity'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    {t('login_activity_desc') || 'Recent devices that have accessed your account. If you see an unfamiliar device, change your password.'}
                </p>
                <div className="divide-y divide-slate-200 dark:divide-slate-700 pt-2">
                    {loginHistory.map((log) => (
                        <div key={log.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                            <div className="h-10 w-10 shrink-0 bg-slate-100 rounded-lg flex items-center justify-center dark:bg-slate-700">
                                {log.type === 'desktop' ? <Monitor className="w-5 h-5 text-slate-500 dark:text-slate-400" /> : <Smartphone className="w-5 h-5 text-slate-500 dark:text-slate-400" />}
                            </div>
                            <div className="flex-1">
                                <p className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    {log.device}
                                    {log.current && <span className="text-[10px] uppercase font-bold text-janmat-blue bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 dark:bg-blue-900/40 dark:border-blue-800 dark:text-blue-300">{t('this_device')}</span>}
                                </p>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                    <span>{log.ip}</span>
                                    <span className="hidden sm:inline">&bull;</span>
                                    <span>{log.location}</span>
                                </p>
                            </div>
                            <div className="text-sm text-slate-400 font-medium whitespace-nowrap dark:text-slate-500">
                                {log.time}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Settings;
