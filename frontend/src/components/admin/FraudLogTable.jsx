import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const FraudLogTable = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/auth/admin/fraud-logs/');
            setLogs(response.data);
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800">Security Incidents & Fraud Attempts</h3>
                <button
                    onClick={fetchLogs}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition-colors flex items-center gap-2 text-sm font-medium"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh Logs
                </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Timestamp</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Voter/Aadhaar</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Booth ID</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Issue Type</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center">Loading logs...</td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-500">No fraud attempts recorded. Great!</td></tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            {new Date(log.flagged_at).toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-700">
                                        {log.aadhaar_masked || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-bold">
                                        {log.booth_number}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold border border-red-200">
                                            {log.fraud_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {log.reviewed ? (
                                            <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                                                <CheckCircle className="w-4 h-4" /> Reviewed
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-amber-600 text-xs font-bold">
                                                <AlertTriangle className="w-4 h-4" /> Pending
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default FraudLogTable;
