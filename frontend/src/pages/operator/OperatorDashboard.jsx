import React from 'react';
import { useAuth } from '../../context/AuthContext';

const OperatorDashboard = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
            <h1 className="text-3xl font-bold text-slate-900">Operator Dashboard</h1>
            <p className="text-slate-600 mt-2">Welcome, {user?.email}</p>
            <div className="mt-8 p-6 bg-white rounded-lg shadow border border-slate-200">
                <p>Verification functionality coming soon...</p>
            </div>
            <button
                onClick={logout}
                className="mt-6 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
                Sign Out
            </button>
        </div>
    );
};

export default OperatorDashboard;
