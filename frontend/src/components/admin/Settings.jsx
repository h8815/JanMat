import React, { useState } from 'react';
import axios from '../../api/axios';
import { Lock, Save, User } from 'lucide-react';

const Settings = ({ user }) => {
    const [passwordData, setPasswordData] = useState({
        old_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
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
            setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update password' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Profile Card */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-janmat-blue" /> Admin Profile
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-500">Name</label>
                        <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 font-bold">
                            {user?.name || 'Admin'}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500">Email Address</label>
                        <div className="mt-1 p-3 bg-slate-50 rounded border border-slate-200 text-slate-700 font-mono">
                            {user?.email}
                        </div>
                    </div>
                </div>
            </div>

            {/* Password Change */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-janmat-blue" /> Change Password
                </h3>

                {message.text && (
                    <div className={`p-4 mb-4 rounded ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Current Password</label>
                        <input
                            type="password"
                            name="old_password"
                            value={passwordData.old_password}
                            onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                        <input
                            type="password"
                            name="new_password"
                            value={passwordData.new_password}
                            onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            name="confirm_password"
                            value={passwordData.confirm_password}
                            onChange={handleChange}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-janmat-blue text-white font-bold rounded hover:bg-janmat-hover disabled:opacity-50 transition-colors"
                    >
                        <Save className="w-4 h-4" /> {loading ? 'Updating...' : 'Update Password'}
                    </button>
                    <p className="text-xs text-slate-500 mt-2">
                        Note: For security, major account changes require SuperAdmin intervention.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Settings;
