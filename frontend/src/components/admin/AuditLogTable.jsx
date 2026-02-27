import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { FileText, RefreshCw, Search, ChevronLeft, ChevronRight, X, Clock, ArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkeletonLoader from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';

const AuditLogTable = () => {
    const { t } = useTranslation();
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

    const renderDetails = (log) => {
        if (!log.details) return '-';

        // Ensure details is an object (Django might send it as a JSON string)
        let parsedDetails = log.details;
        if (typeof parsedDetails === 'string') {
            try {
                parsedDetails = JSON.parse(parsedDetails);
            } catch {
                return log.details;
            }
        }

        if (log.action === 'biometric_scan' && parsedDetails.quality) {
            return `Biometric Scan Quality: ${parsedDetails.quality}%`;
        }

        // For other actions, sanitize the output (remove voter IDs for better UX)
        const displayObj = { ...parsedDetails };
        delete displayObj.voter_id; // Hide unnecessary UUIDs from UI

        const str = JSON.stringify(displayObj);
        if (str === '{}') return '-';
        return str.length > 50 ? str.substring(0, 50) + '...' : str;
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex-wrap gap-4 dark:bg-slate-800 dark:border-slate-700">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder={t('search_audit_placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
                <button
                    onClick={() => fetchLogs(page, searchQuery)}
                    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition-colors text-sm font-medium dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-600"
                >
                    <RefreshCw className="w-4 h-4" /> {t('btn_refresh')}
                </button>
            </div>

            <div className="md:hidden text-xs text-slate-500 mb-2 flex items-center gap-1 dark:text-slate-400">
                <ArrowLeftRight className="w-3 h-3" /> {t('swipe_to_scroll') || 'Swipe horizontally to view all columns'}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[400px] dark:bg-slate-800 dark:border-slate-700">
                <div className="overflow-x-auto flex-grow touch-pan-x snap-x">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_timestamp')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_action')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_actor')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_ip_address')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_details')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan="5" className="px-6 py-4">
                                            <SkeletonLoader type="table-row" />
                                        </td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8">
                                        <EmptyState
                                            icon={FileText}
                                            title={t('no_audit_logs_title') || 'No Audit Logs'}
                                            message={t('no_audit_logs_desc') || 'There are no recent audit logs to display for the current filters.'}
                                        />
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono dark:text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                                {new Date(log.timestamp).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded uppercase border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300">
                                            <div className="font-bold flex items-center gap-1">
                                                {log.user_type === 'admin' ? <FileText className="w-3 h-3 text-janmat-blue dark:text-janmat-light" /> : null}
                                                {log.user_name || log.user_type.toUpperCase()}
                                            </div>
                                            <div className="text-xs text-slate-400">{log.user_type.toUpperCase()}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono dark:text-slate-400">
                                            {log.ip_address || '—'}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate dark:text-slate-400" title={JSON.stringify(log.details, null, 2)}>
                                            {renderDetails(log)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center dark:bg-slate-900 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Page <span className="font-bold">{pagination.page}</span> of <span className="font-bold">{pagination.pages}</span> ({pagination.total} records)
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={!pagination.has_previous}
                            className="p-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={!pagination.has_next}
                            className="p-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600"
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
