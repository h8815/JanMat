import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { FileText, RefreshCw, Search } from 'lucide-react';

const AuditLogTable = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/auth/admin/audit-logs/');
            setLogs(response.data);
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log =>
        (log.action || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details?.info || JSON.stringify(log.details) || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.user_type || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none text-sm"
                    />
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition-colors text-sm font-medium"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Actor</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Details</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center">Loading audit trails...</td></tr>
                        ) : filteredLogs.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-500">No logs found.</td></tr>
                        ) : (
                            filteredLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                        {new Date(log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded uppercase border border-slate-200">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                                        <div className="font-bold flex items-center gap-1">
                                            {log.user_type === 'admin' ? <FileText className="w-3 h-3 text-janmat-blue" /> : null}
                                            {log.user_type.toUpperCase()}
                                        </div>
                                        <div className="text-xs text-slate-400">ID: {log.user_id}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                        {log.ip_address || '—'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={JSON.stringify(log.details)}>
                                        {log.details ? JSON.stringify(log.details).substring(0, 50) + (JSON.stringify(log.details).length > 50 ? '...' : '') : '-'}
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

export default AuditLogTable;
