import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const FraudLogTable = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);

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

    const handleRowClick = async (logId) => {
        try {
            // Fetch detailed log (which also marks it as reviewed)
            const response = await axios.get(`/auth/admin/fraud-logs/${logId}/`);
            setSelectedLog(response.data);
            setModalOpen(true);

            // Update local state to reflect 'Reviewed' instantly
            setLogs(prevLogs => prevLogs.map(log =>
                log.id === logId ? { ...log, reviewed: true } : log
            ));
        } catch (error) {
            console.error("Failed to fetch log detail", error);
            alert("Could not load details");
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    // Helper for placeholders
    const getVoterData = () => {
        if (!selectedLog) return {};
        const v = selectedLog.voter || {};
        return {
            name: v.full_name || "Unknown Voter",
            dob: v.dob || "XX/XX/XXXX",
            gender: v.gender || "Unknown",
            aadhaar: selectedLog.aadhaar_number || "XXXX XXXX XXXX",
            photo: v.photo, // Base64 or URL
            address: v.address || "Address not available"
        };
    };

    const voter = getVoterData();

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
                                <tr
                                    key={log.id}
                                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                                    onClick={() => handleRowClick(log.id)}
                                >
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

            {/* Detail Modal - Aadhaar Card UI */}
            {modalOpen && selectedLog && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        {/* Modal Header */}
                        <div className="flex justify-between items-center bg-slate-100 px-6 py-4 border-b">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="text-red-600" />
                                Fraud Incident Details
                            </h2>
                            <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>

                        <div className="p-8 bg-slate-50 flex flex-col items-center">
                            {/* Realistic Aadhaar Card UI */}
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
                                <div className="bg-white p-3 rounded border border-slate-200">
                                    <p className="text-xs text-slate-500 font-bold uppercase">Incident Type</p>
                                    <p className="font-bold text-red-600">{selectedLog.fraud_type}</p>
                                </div>
                                <div className="bg-white p-3 rounded border border-slate-200">
                                    <p className="text-xs text-slate-500 font-bold uppercase">Booth Location</p>
                                    <p className="font-bold text-slate-800">{selectedLog.booth_number}</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-4 bg-slate-100 flex justify-end border-t">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-6 py-2 bg-slate-800 text-white font-bold rounded shadow hover:bg-slate-700 transition-colors"
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
