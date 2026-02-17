import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { Plus, Search, RefreshCw, Eye, EyeOff, ShieldAlert, Edit2, Trash2, X, CheckSquare, Square } from 'lucide-react';

const OperatorList = () => {
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [currentOperator, setCurrentOperator] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Bulk Selection State
    const [selectedIds, setSelectedIds] = useState(new Set());

    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === sortedOperators.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(sortedOperators.map(op => op.id)));
        }
    };

    const handleBulkAction = async (action) => {
        if (!confirm(`Are you sure you want to ${action} ${selectedIds.size} operators?`)) return;

        try {
            await axios.post('/auth/admin/operators/bulk/', {
                ids: Array.from(selectedIds),
                action: action
            });
            fetchOperators();
            setSelectedIds(new Set());
        } catch (error) {
            console.error("Bulk action failed", error);
            alert("Failed to perform bulk action");
        }
    };

    // Sorting State
    const [sortConfig, setSortConfig] = useState({ key: 'verifications', direction: 'desc' });

    const fetchOperators = async () => {
        setLoading(true);
        try {
            const response = await axios.get('/auth/admin/operators/');
            setOperators(response.data);
        } catch (error) {
            console.error("Failed to fetch operators", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOperators();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this operator? This action cannot be undone.')) {
            try {
                await axios.delete(`/auth/admin/operators/${id}/`);
                setOperators(operators.filter(op => op.id !== id));
            } catch (error) {
                alert('Failed to delete operator');
            }
        }
    };

    const handleEdit = (operator) => {
        setCurrentOperator(operator);
        setIsEditModalOpen(true);
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredOperators = operators.filter(op =>
        (op.full_name || op.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.booth_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedOperators = [...filteredOperators].sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'verifications') {
            aValue = a.metrics?.verifications || 0;
            bValue = b.metrics?.verifications || 0;
        } else if (sortConfig.key === 'fraud') {
            aValue = a.metrics?.fraud_flags || 0;
            bValue = b.metrics?.fraud_flags || 0;
        } else {
            // Default string sort
            aValue = a[sortConfig.key] || '';
            bValue = b[sortConfig.key] || '';
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Helper for Sort Icon
    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <div className="w-3 h-3 inline-block ml-1 opacity-20">↕</div>;
        return <div className="w-3 h-3 inline-block ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</div>;
    };

    // Performance Stats
    const totalVerifications = operators.reduce((sum, op) => sum + (op.metrics?.verifications || 0), 0);
    const totalFraud = operators.reduce((sum, op) => sum + (op.metrics?.fraud_flags || 0), 0);
    const topPerformer = [...operators].sort((a, b) => (b.metrics?.verifications || 0) - (a.metrics?.verifications || 0))[0];

    return (
        <div className="space-y-6">
            {/* Performance Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1 dark:text-slate-400">Top Performer</p>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold">
                            {topPerformer ? (topPerformer.full_name || topPerformer.name || 'O').charAt(0) : '-'}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{topPerformer ? (topPerformer.full_name || topPerformer.name) : 'No Data'}</h3>
                            <p className="text-xs text-slate-500 font-mono dark:text-slate-400">{topPerformer ? `${topPerformer.metrics?.verifications} Verifications` : ''}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1 dark:text-slate-400">Total Operator Activity</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{totalVerifications}</h3>
                    <p className="text-xs text-green-600 font-medium mt-1">Successful Verifications</p>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1 dark:text-slate-400">Security Risks Triggered</p>
                    <h3 className="text-3xl font-bold text-red-600 dark:text-red-400">{totalFraud}</h3>
                    <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">Across all operators</p>
                </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedIds.size > 0 && (
                <div className="bg-janmat-blue text-white p-4 rounded-lg shadow-lg flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
                    <span className="font-bold">{selectedIds.size} Selected</span>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleBulkAction('activate')}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                        >
                            Activate
                        </button>
                        <button
                            onClick={() => handleBulkAction('deactivate')}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                        >
                            Deactivate
                        </button>
                        <div className="w-px bg-white/30 mx-1"></div>
                        <button
                            onClick={() => handleBulkAction('delete')}
                            className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
                        >
                            Delete
                        </button>
                        <button
                            onClick={() => setSelectedIds(new Set())}
                            className="text-white/70 hover:text-white px-2"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                <div className="relative w-96">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search operators..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-janmat-blue focus:border-transparent outline-none text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <div className="flex gap-2">

                    <button
                        onClick={fetchOperators}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded border border-slate-300 transition-colors dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-600"
                        title="Refresh List"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-janmat-blue text-white font-bold rounded hover:bg-janmat-hover transition-colors text-sm"
                    >
                        <Plus className="w-4 h-4" /> Add Operator
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-900">
                        <tr>
                            <th className="px-6 py-3 w-10">
                                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-janmat-blue">
                                    {sortedOperators.length > 0 && selectedIds.size === sortedOperators.length ? (
                                        <CheckSquare className="w-5 h-5 text-janmat-blue" />
                                    ) : (
                                        <Square className="w-5 h-5" />
                                    )}
                                </button>
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400 cursor-pointer hover:text-janmat-blue" onClick={() => handleSort('full_name')}>
                                Operator Name <SortIcon column="full_name" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Booth ID</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400 cursor-pointer hover:text-janmat-blue" onClick={() => handleSort('verifications')}>
                                Verifications <SortIcon column="verifications" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400 cursor-pointer hover:text-janmat-blue" onClick={() => handleSort('fraud')}>
                                Fraud Flags <SortIcon column="fraud" />
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                        {loading ? (
                            <tr><td colSpan="6" className="p-8 text-center dark:text-slate-400">Loading operators...</td></tr>
                        ) : sortedOperators.length === 0 ? (
                            <tr><td colSpan="6" className="p-8 text-center text-slate-500 dark:text-slate-400">No operators found.</td></tr>
                        ) : (
                            sortedOperators.map((op) => (
                                <tr key={op.id} className={`hover:bg-slate-50 dark:hover:bg-slate-700 ${selectedIds.has(op.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <button onClick={() => toggleSelect(op.id)} className="text-slate-400 hover:text-janmat-blue">
                                            {selectedIds.has(op.id) ? (
                                                <CheckSquare className="w-5 h-5 text-janmat-blue" />
                                            ) : (
                                                <Square className="w-5 h-5" />
                                            )}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-janmat-blue font-bold text-xs mr-3 dark:bg-blue-900 dark:text-blue-200">
                                                {(op.full_name || op.name || 'O').charAt(0)}
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-slate-900 dark:text-white">{op.full_name || op.name}</div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400">{op.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-mono font-bold dark:text-slate-300">
                                        {op.booth_id}
                                    </td>
                                    {/* Metrics: Verifications */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-1">
                                            <span className="font-bold text-slate-700 dark:text-white">{op.metrics?.verifications || 0}</span>
                                        </div>
                                    </td>
                                    {/* Metrics: Fraud */}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {op.metrics?.fraud_flags > 0 ? (
                                            <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-bold dark:bg-red-900 dark:text-red-200">
                                                {op.metrics.fraud_flags} Flags
                                            </span>
                                        ) : (
                                            <span className="text-xs text-slate-400 dark:text-slate-500">None</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${op.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                            }`}>
                                            {op.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 flex gap-2">
                                        <button
                                            onClick={() => handleEdit(op)}
                                            className="p-1 text-slate-400 hover:text-janmat-blue transition-colors dark:hover:text-janmat-light"
                                            title="Edit"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(op.id)}
                                            className="p-1 text-slate-400 hover:text-red-600 transition-colors dark:hover:text-red-400"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddOperatorModal onClose={() => setIsAddModalOpen(false)} onSuccess={() => { setIsAddModalOpen(false); fetchOperators(); }} />}
            {isEditModalOpen && currentOperator && <EditOperatorModal operator={currentOperator} onClose={() => setIsEditModalOpen(false)} onSuccess={() => { setIsEditModalOpen(false); fetchOperators(); }} />}

        </div>
    );
};

const AddOperatorModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        booth_id: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.post('/auth/admin/create-operator/', formData);
            onSuccess();
        } catch (err) {
            let errorMsg = 'Failed to create operator';
            if (err.response?.data) {
                if (err.response.data.details) {
                    const details = err.response.data.details;
                    errorMsg = Object.entries(details)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
                        .join('\n');
                } else if (err.response.data.error) {
                    errorMsg = err.response.data.error;
                }
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden dark:bg-slate-800 dark:border dark:border-slate-700">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Add New Operator</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2 dark:bg-red-900/20 dark:text-red-300">
                        <ShieldAlert className="w-4 h-4" /> {error}
                    </div>}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Full Name</label>
                        <input name="full_name" value={formData.full_name} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Email Address</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Booth ID</label>
                        <input name="booth_id" value={formData.booth_id} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required placeholder="e.g. B-001" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full p-2 border rounded focus:ring-2 focus:ring-janmat-blue outline-none pr-10 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-medium dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-janmat-blue text-white rounded font-bold hover:bg-janmat-hover disabled:opacity-50">
                            {loading ? 'Creating...' : 'Create Operator'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditOperatorModal = ({ operator, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        full_name: operator.full_name || operator.name || '',
        booth_id: operator.booth_id || '',
        is_active: operator.is_active
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await axios.put(`/auth/admin/operators/${operator.id}/`, formData);
            onSuccess();
        } catch (err) {
            let errorMsg = 'Failed to update operator';
            if (err.response?.data) {
                if (err.response.data.details) {
                    const details = err.response.data.details;
                    errorMsg = Object.entries(details)
                        .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(' ') : val}`)
                        .join('\n');
                } else if (err.response.data.error) {
                    errorMsg = err.response.data.error;
                }
            }
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden dark:bg-slate-800 dark:border dark:border-slate-700">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Edit Operator</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2 dark:bg-red-900/20 dark:text-red-300">
                        <ShieldAlert className="w-4 h-4" /> {error}
                    </div>}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Email (Read Only)</label>
                        <input value={operator.email} disabled className="w-full p-2 border border-slate-200 bg-slate-50 rounded text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Full Name</label>
                        <input name="full_name" value={formData.full_name} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">Booth ID</label>
                        <input name="booth_id" value={formData.booth_id} onChange={handleChange} className="w-full p-2 border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleChange}
                            className="w-4 h-4 text-janmat-blue border-gray-300 rounded focus:ring-janmat-blue dark:bg-slate-700 dark:border-slate-600"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300">Active Account</label>
                    </div>

                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded font-medium dark:text-slate-300 dark:hover:bg-slate-700">Cancel</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-janmat-blue text-white rounded font-bold hover:bg-janmat-hover disabled:opacity-50">
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OperatorList;
