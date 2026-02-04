import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { Lock, Save, User, Edit2, X, AlertCircle, CheckCircle, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const Settings = ({ user }) => {
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
                        <User className="w-5 h-5 text-janmat-blue dark:text-janmat-light" /> Admin Profile
                    </h3>
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1 text-sm text-slate-500 hover:text-janmat-blue transition-colors dark:text-slate-400 dark:hover:text-janmat-light"
                        >
                            <Edit2 className="w-4 h-4" /> Edit Profile
                        </button>
                    ) : (
                        <button
                            onClick={() => setIsEditing(false)}
                            className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600 transition-colors dark:text-slate-400 dark:hover:text-red-400"
                        >
                            <X className="w-4 h-4" /> Cancel
                        </button>
                    )}
                </div>

                {isEditing ? (
                    <form onSubmit={handleProfileSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={profileData.name}
                                    onChange={handleProfileChange}
                                    className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Email <span className="text-xs text-slate-400">(Unique)</span></label>
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
                                <Save className="w-4 h-4" /> Save Changes
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Name</label>
                            <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 font-bold dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                {profileData.name || 'Admin'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Email Address</label>
                            <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 font-mono dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300">
                                {profileData.email}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Admin ID</label>
                            <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-500 font-mono text-xs dark:bg-slate-700 dark:border-slate-600 dark:text-slate-400">
                                {user?.id || 'N/A'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 dark:text-slate-400">Role</label>
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
                    <Lock className="w-5 h-5 text-janmat-blue dark:text-janmat-light" /> Change Password
                </h3>

                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Current Password</label>
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
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">New Password</label>
                        <input
                            type="password"
                            name="new_password"
                            value={passwordData.new_password}
                            onChange={handlePasswordChange}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Confirm New Password</label>
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
                        <Save className="w-4 h-4" /> Update Password
                    </button>
                    <p className="text-xs text-slate-500 mt-2 dark:text-slate-400">
                        Note: For security, major account changes require SuperAdmin intervention.
                    </p>
                </form>
            </div>

            {/* Appearance Settings */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 dark:text-white">
                    {theme === 'dark' ? <Moon className="w-5 h-5 text-janmat-blue dark:text-janmat-light" /> : <Sun className="w-5 h-5 text-janmat-blue" />}
                    Appearance
                </h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-medium text-slate-800 dark:text-white">Dark Mode</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Switch between light and dark themes.</p>
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
        </div>
    );
};

export default Settings;
