import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { FileText, RefreshCw, Search, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';

const AuditLogTable = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Search & Pagination State
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        total: 0,
        pages: 1,
        has_next: false,
        has_previous: false
    });

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1); // Reset to page 1 on search
            fetchLogs(1, searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Manual page change triggers fetch
    useEffect(() => {
        if (page > 1) fetchLogs(page, searchQuery);
    }, [page]);

    const fetchLogs = async (pageNum = page, search = searchQuery) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.append('search', search);
            params.append('page', pageNum);
            params.append('limit', 15);

            const response = await axios.get(`/auth/admin/audit-logs/?${params.toString()}`);
            setLogs(response.data.logs || []);
            setPagination({
                total: response.data.total,
                pages: response.data.pages,
                has_next: response.data.has_next,
                has_previous: response.data.has_previous
            });
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            setPage(newPage);
            // Fix: logic in useEffect ignores page 1 to prevent double-fetch on search
            // So we must manually fetch if navigating back to page 1
            if (newPage === 1) {
                fetchLogs(1, searchQuery);
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex-wrap gap-4">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search logs (Action, IP, User ID)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none text-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => fetchLogs(page, searchQuery)}
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition-colors text-sm font-medium"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="overflow-x-auto flex-grow">
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
                                <tr><td colSpan="5" className="p-8 text-center text-slate-500">Loading audit trails...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-500">No logs found matching criteria.</td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {new Date(log.timestamp).toLocaleString()}
                                            </div>
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
                                            <div className="text-xs text-slate-400 font-mono">ID: {log.user_id || 'N/A'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                                            {log.ip_address || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                                            {log.details ? JSON.stringify(log.details).substring(0, 50) + (JSON.stringify(log.details).length > 50 ? '...' : '') : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center">
                    <p className="text-xs text-slate-500">
                        Page <span className="font-bold">{pagination.page}</span> of <span className="font-bold">{pagination.pages}</span> ({pagination.total} records)
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={!pagination.has_previous}
                            className="p-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={!pagination.has_next}
                            className="p-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuditLogTable;
