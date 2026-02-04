import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, Search, Filter, ChevronLeft, ChevronRight, X } from 'lucide-react';

const FraudLogTable = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

    // Filter & Pagination State
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        type: '',
        status: '',
        page: 1,
        limit: 10
    });
    const [pagination, setPagination] = useState({
        total: 0,
        pages: 1,
        has_next: false,
        has_previous: false
    });

    // Debounce Search
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters(prev => ({ ...prev, search: searchQuery, page: 1 }));
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.type) params.append('type', filters.type);
            if (filters.status) params.append('status', filters.status);
            params.append('page', filters.page);
            params.append('limit', filters.limit);

            const response = await axios.get(`/auth/admin/fraud-logs/?${params.toString()}`);
            setLogs(response.data.logs || []);
            setPagination({
                total: response.data.total,
                pages: response.data.pages,
                has_next: response.data.has_next,
                has_previous: response.data.has_previous
            });
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [filters.page, filters.type, filters.status, filters.search]);

    const handleRowClick = async (logId) => {
        try {
            const response = await axios.get(`/auth/admin/fraud-logs/${logId}/`);
            setSelectedLog(response.data);
            setModalOpen(true);

            setLogs(prevLogs => prevLogs.map(log =>
                log.id === logId ? { ...log, reviewed: true } : log
            ));
        } catch (error) {
            console.error("Failed to fetch log detail", error);
            alert("Could not load details");
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= pagination.pages) {
            setFilters(prev => ({ ...prev, page: newPage }));
        }
    };

    // Helper for placeholders
    const getVoterData = () => {
        if (!selectedLog) return {};
        const v = selectedLog.voter || {};
        return {
            name: v.full_name || "Unknown Voter",
            dob: v.dob || "XX/XX/XXXX",
            gender: v.gender || "Unknown",
            aadhaar: selectedLog.aadhaar_number || "XXXX XXXX XXXX",
            photo: v.photo,
            address: v.address || "Address not available"
        };
    };

    const voter = getVoterData();

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg dark:text-white">Security Incidents & Fraud Attempts</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Monitor and review flagged polling activities</p>
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* Search */}
                    <div className="relative flex-grow md:flex-grow-0">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search Aadhaar or Booth..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue outline-none w-full md:w-64 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
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

                    {/* Filters */}
                    <select
                        className="px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        value={filters.type}
                        onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value, page: 1 }))}
                    >
                        <option value="">All Fraud Types</option>
                        <option value="duplicate_biometric">Duplicate Biometric</option>
                        <option value="multiple_otp_attempts">Multiple OTPs</option>
                        <option value="already_voted">Already Voted</option>
                        <option value="invalid_session">Invalid Session</option>
                        <option value="suspicious_activity">Suspicious Activity</option>
                    </select>

                    <select
                        className="px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue outline-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        value={filters.status}
                        onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending Review</option>
                        <option value="reviewed">Reviewed</option>
                    </select>

                    <button
                        onClick={fetchLogs}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition-colors dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-600"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px] dark:bg-slate-800 dark:border-slate-700">
                <div className="flex-grow overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200 relative dark:divide-slate-700">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm dark:bg-slate-900">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Timestamp</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Voter/Aadhaar</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Booth ID</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Issue Type</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400">Loading logs...</td></tr>
                            ) : logs.length === 0 ? (
                                <tr><td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle className="w-8 h-8 text-green-500 opacity-50" />
                                        <p>No records found matching your criteria.</p>
                                    </div>
                                </td></tr>
                            ) : (
                                logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-slate-50 cursor-pointer transition-colors dark:hover:bg-slate-700"
                                        onClick={() => handleRowClick(log.id)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-slate-400" />
                                                {new Date(log.flagged_at).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-slate-700 dark:text-slate-200">
                                            {log.aadhaar_masked || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-bold dark:text-slate-300">
                                            {log.booth_number}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-900">
                                                {log.fraud_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {log.reviewed ? (
                                                <span className="flex items-center gap-1 text-green-600 text-xs font-bold dark:text-green-400">
                                                    <CheckCircle className="w-4 h-4" /> Reviewed
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-amber-600 text-xs font-bold dark:text-amber-400">
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

                {/* Pagination Footer */}
                <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-between items-center dark:bg-slate-900 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Showing page <span className="font-bold">{pagination.page}</span> of <span className="font-bold">{pagination.pages}</span> ({pagination.total} records)
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => handlePageChange(filters.page - 1)}
                            disabled={!pagination.has_previous}
                            className="p-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handlePageChange(filters.page + 1)}
                            disabled={!pagination.has_next}
                            className="p-1 rounded border bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 dark:bg-slate-700 dark:border-slate-600 dark:text-white dark:hover:bg-slate-600"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Detail Modal - Aadhaar Card UI */}
            {modalOpen && selectedLog && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-in fade-in zoom-in-95 duration-200 overflow-hidden dark:bg-slate-800 dark:border dark:border-slate-700">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center bg-slate-100 px-6 py-4 border-b dark:bg-slate-900 dark:border-slate-700">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 dark:text-white">
                                <AlertTriangle className="text-red-600" />
                                Fraud Incident Details
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>

                        <div className="p-8 bg-slate-50 flex flex-col items-center dark:bg-slate-800">
                            {/* Realistic Aadhaar Card UI - Keep this mostly light as it mimics a physical card, but perhaps dim it slightly or keep it stark against dark background */}
                            <div className="w-full max-w-md bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden relative">
                                {/* Card Header */}
                                <div className="bg-gradient-to-r from-orange-100 via-white to-green-100 p-3 border-b border-slate-100 flex items-center justify-between">
                                    <div className="w-12 h-12 grayscale opacity-50 bg-[url('https://upload.wikimedia.org/wikipedia/commons/5/55/Emblem_of_India.svg')] bg-contain bg-no-repeat bg-center"></div>
                                    <div className="text-center">
                                        <p className="text-xs font-bold text-slate-600">Government of India</p>
                                        <p className="text-[10px] text-slate-500">Unique Identification Authority of India</p>
                                    </div>
                                    <div className="w-12 h-12"></div> {/* Spacer for balance */}
                                </div>

                                {/* Card Body */}
                                <div className="p-4 flex gap-4 items-start relative">
                                    {/* Photo */}
                                    <div className="w-24 h-32 bg-slate-200 rounded border border-slate-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                                        {voter.photo ? (
                                            <img src={voter.photo} alt="Voter" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-slate-400 text-center text-xs">
                                                <div className="w-12 h-12 mx-auto mb-1 bg-slate-300 rounded-full" />
                                                No Photo
                                            </div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    <div className="flex-1 space-y-1">
                                        <p className="font-bold text-lg text-slate-900">{voter.name}</p>
                                        <p className="text-xs text-slate-600">DOB: <span className="font-semibold text-slate-800">{voter.dob}</span></p>
                                        <p className="text-xs text-slate-600">Gender: <span className="font-semibold text-slate-800">{voter.gender}</span></p>
                                        <div className="mt-2 text-xs text-slate-600">
                                            Address:
                                            <p className="font-semibold text-slate-800 leading-tight mt-0.5">{voter.address}</p>
                                        </div>

                                        <div className="mt-4 pt-2 border-t border-dashed border-slate-200">
                                            <p className="text-xl font-mono font-bold text-slate-800 tracking-widest text-center">
                                                {voter.aadhaar}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Footer */}
                                <div className="bg-red-600 text-white text-center py-1 text-[10px] font-bold uppercase tracking-wider">
                                    Identity Verified - Fraud Flagged
                                </div>
                            </div>

                            {/* Incident Meta Info */}
                            <div className="mt-6 w-full grid grid-cols-2 gap-4 text-sm">
                                <div className="bg-white p-3 rounded border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                                    <p className="text-xs text-slate-500 font-bold uppercase dark:text-slate-400">Incident Type</p>
                                    <p className="font-bold text-red-600 dark:text-red-400">{selectedLog.fraud_type}</p>
                                </div>
                                <div className="bg-white p-3 rounded border border-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200">
                                    <p className="text-xs text-slate-500 font-bold uppercase dark:text-slate-400">Booth Location</p>
                                    <p className="font-bold text-slate-800 dark:text-white">{selectedLog.booth_number}</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-100 flex justify-end border-t dark:bg-slate-900 dark:border-slate-700">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-6 py-2 bg-slate-800 text-white font-bold rounded shadow hover:bg-slate-700 transition-colors dark:bg-slate-700 dark:hover:bg-slate-600"
                            >
                                Acknowledge & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FraudLogTable;
