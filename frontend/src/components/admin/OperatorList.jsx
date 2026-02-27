import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { Plus, Search, RefreshCw, Eye, EyeOff, ShieldAlert, Edit2, Trash2, X, CheckSquare, Square, Users, ArrowLeftRight, Power, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SkeletonLoader from '../common/SkeletonLoader';
import EmptyState from '../common/EmptyState';
import ConfirmationModal from '../common/ConfirmationModal';

const OperatorList = () => {
    const { t } = useTranslation();
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [currentOperator, setCurrentOperator] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        isDanger: false,
        onConfirm: () => { }
    });

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
        setConfirmModal({
            isOpen: true,
            title: t('confirm_bulk_action_title', { action: action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ') }) || `Confirm ${action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}`,
            message: t('confirm_bulk_action_desc', { count: selectedIds.size, action: action.replace('_', ' ') }) || `Are you sure you want to ${action.replace('_', ' ')} ${selectedIds.size} operators?`,
            isDanger: action === 'delete',
            onConfirm: async () => {
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
            }
        });
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
        setConfirmModal({
            isOpen: true,
            title: t('confirm_delete_operator_title') || 'Delete Operator',
            message: t('confirm_delete_operator_desc') || 'Are you sure you want to delete this operator? This action cannot be undone.',
            isDanger: true,
            onConfirm: async () => {
                try {
                    await axios.delete(`/auth/admin/operators/${id}/`);
                    setOperators(operators.filter(op => op.id !== id));
                } catch {
                    alert('Failed to delete operator');
                }
            }
        });
    };

    const handleEdit = (operator) => {
        setCurrentOperator(operator);
        setIsEditModalOpen(true);
    };

    const handleToggleStatus = (op) => {
        setConfirmModal({
            isOpen: true,
            title: op.is_active
                ? (t('confirm_deactivate_title') || 'Deactivate Operator')
                : (t('confirm_activate_title') || 'Activate Operator'),
            message: op.is_active
                ? (t('confirm_deactivate_desc', { name: op.full_name || op.name }) || `Are you sure you want to deactivate ${op.full_name || op.name}? They will not be able to log in.`)
                : (t('confirm_activate_desc', { name: op.full_name || op.name }) || `Activate ${op.full_name || op.name}? They will be able to log in again.`),
            isDanger: op.is_active,
            onConfirm: async () => {
                try {
                    const res = await axios.post(`/auth/admin/operators/${op.id}/toggle/`);
                    // Update local state immediately for instant feedback
                    setOperators(prev => prev.map(o =>
                        o.id === op.id ? { ...o, is_active: res.data.is_active } : o
                    ));
                } catch (error) {
                    console.error('Toggle status failed', error);
                    alert('Failed to update operator status. Please try again.');
                }
            }
        });
    };

    const handleSendCredentials = (op) => {
        setConfirmModal({
            isOpen: true,
            title: t('confirm_send_email_title') || 'Send Credentials',
            message: t('confirm_send_email_desc', { email: op.email }) || `Are you sure you want to generate a new password and email it to ${op.email}?`,
            isDanger: false,
            onConfirm: async () => {
                try {
                    await axios.post(`/auth/admin/operators/${op.id}/send-credentials/`);
                    alert(t('email_sent_successfully') || 'Credentials sent successfully!');
                } catch (error) {
                    console.error('Send credentials failed', error);
                    alert(t('email_send_failed') || 'Failed to send credentials.');
                }
            }
        });
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredOperators = operators.filter(op => {
        const matchesSearch =
            (op.full_name || op.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (op.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (op.booth_id || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && op.is_active) ||
            (statusFilter === 'inactive' && !op.is_active);
        return matchesSearch && matchesStatus;
    });

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
                    <p className="text-slate-500 text-sm font-medium mb-1 dark:text-slate-400">{t('top_performer')}</p>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-yellow-100 text-yellow-700 flex items-center justify-center font-bold">
                            {topPerformer ? (topPerformer.full_name || topPerformer.name || 'O').charAt(0) : '-'}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 dark:text-white">{topPerformer ? (topPerformer.full_name || topPerformer.name) : t('no_data')}</h3>
                            <p className="text-xs text-slate-500 font-mono dark:text-slate-400">{topPerformer ? `${topPerformer.metrics?.verifications} ${t('col_verifications')}` : ''}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1 dark:text-slate-400">{t('total_operator_activity')}</p>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white">{totalVerifications}</h3>
                    <p className="text-xs text-green-600 font-medium mt-1">{t('successful_verifications')}</p>
                </div>

                <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm dark:bg-slate-800 dark:border-slate-700">
                    <p className="text-slate-500 text-sm font-medium mb-1 dark:text-slate-400">{t('security_risks')}</p>
                    <h3 className="text-3xl font-bold text-red-600 dark:text-red-400">{totalFraud}</h3>
                    <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">{t('across_all')}</p>
                </div>
            </div>

            {/* Bulk Action Toolbar */}
            {selectedIds.size > 0 && (
                <div className="bg-janmat-blue text-white p-4 rounded-lg shadow-lg flex justify-between items-center animate-in slide-in-from-top-2 duration-300">
                    <span className="font-bold">{selectedIds.size} {t('selected')}</span>
                    <div className="flex gap-3">
                        <button
                            onClick={() => handleBulkAction('activate')}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                        >
                            {t('btn_activate')}
                        </button>
                        <button
                            onClick={() => handleBulkAction('deactivate')}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                        >
                            {t('btn_deactivate')}
                        </button>
                        <button
                            onClick={() => handleBulkAction('send_credentials')}
                            className="bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded text-sm font-medium transition-colors"
                        >
                            {t('btn_send_credentials')}
                        </button>
                        <div className="w-px bg-white/30 mx-1"></div>
                        <button
                            onClick={() => handleBulkAction('delete')}
                            className="bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm"
                        >
                            {t('btn_delete')}
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
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="relative w-full max-w-xs">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder={t('search_operators')}
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
                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="py-2 px-3 border border-slate-300 rounded text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-janmat-blue outline-none"
                    >
                        <option value="all">{t('filter_all_status_op') || 'All Operators'}</option>
                        <option value="active">{t('filter_active') || 'Active'}</option>
                        <option value="inactive">{t('filter_inactive') || 'Inactive'}</option>
                    </select>
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
                        <Plus className="w-4 h-4" /> {t('add_operator')}
                    </button>
                </div>
            </div>

            <div className="md:hidden text-xs text-slate-500 mb-2 flex items-center gap-1 dark:text-slate-400 mt-2">
                <ArrowLeftRight className="w-3 h-3" /> {t('swipe_to_scroll') || 'Swipe horizontally to view all columns'}
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                <div className="overflow-x-auto flex-grow touch-pan-x snap-x">
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
                                    {t('col_operator')} <SortIcon column="full_name" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_booth')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400 cursor-pointer hover:text-janmat-blue" onClick={() => handleSort('verifications')}>
                                    {t('col_verifications')} <SortIcon column="verifications" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400 cursor-pointer hover:text-janmat-blue" onClick={() => handleSort('fraud')}>
                                    {t('col_fraud_flags')} <SortIcon column="fraud" />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_status')}</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">{t('col_actions')}</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan="8" className="px-6 py-4">
                                            <SkeletonLoader type="table-row" />
                                        </td>
                                    </tr>
                                ))
                            ) : sortedOperators.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8">
                                        <EmptyState
                                            icon={Users}
                                            title={t('no_operators_title') || 'No Operators Found'}
                                            message={t('no_operators_desc') || 'We could not find any booth operators matching your search or filters.'}
                                        />
                                    </td>
                                </tr>
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
                                                onClick={() => handleToggleStatus(op)}
                                                className={`p-1 transition-colors ${op.is_active ? 'text-green-500 hover:text-red-500' : 'text-slate-400 hover:text-green-600'} dark:hover:text-green-400`}
                                                title={op.is_active ? 'Deactivate Operator' : 'Activate Operator'}
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleSendCredentials(op)}
                                                className="p-1 text-slate-400 hover:text-janmat-blue transition-colors dark:hover:text-blue-400"
                                                title={t('btn_send_credentials') || 'Send Credentials Email'}
                                            >
                                                <Mail className="w-4 h-4" />
                                            </button>
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

                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    isDanger={confirmModal.isDanger}
                    onConfirm={confirmModal.onConfirm}
                    confirmText={confirmModal.isDanger ? (t('btn_delete') || 'Delete') : (t('btn_confirm') || 'Confirm')}
                    cancelText={t('btn_cancel') || 'Cancel'}
                />
            </div>
        </div>
    );
};

const AddOperatorModal = ({ onClose, onSuccess }) => {
    const { t } = useTranslation();
    const [formData, setFormData] = useState({
        full_name: '',
        email: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 dark:bg-slate-800 dark:border dark:border-slate-700 mt-auto sm:mt-0">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{t('add_operator_modal_title')}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2 dark:bg-red-900/20 dark:text-red-300">
                        <ShieldAlert className="w-4 h-4" /> {error}
                    </div>}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_full_name')}</label>
                        <input name="full_name" value={formData.full_name} onChange={handleChange} className="w-full p-3 sm:p-2 min-h-[44px] border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_email')}</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-3 sm:p-2 min-h-[44px] border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>



                    <div className="pt-4 pb-8 sm:pb-0 flex flex-col sm:flex-row justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-3 sm:py-2 min-h-[44px] text-slate-600 hover:bg-slate-100 rounded-lg font-medium border border-slate-200 sm:border-transparent dark:text-slate-300 dark:hover:bg-slate-700">{t('cancel')}</button>
                        <button type="submit" disabled={loading} className="px-4 py-3 sm:py-2 min-h-[44px] bg-janmat-blue text-white rounded-lg font-bold hover:bg-janmat-hover disabled:opacity-50">
                            {loading ? t('btn_creating') : t('btn_create_operator')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditOperatorModal = ({ operator, onClose, onSuccess }) => {
    const { t } = useTranslation();
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 dark:bg-slate-800 dark:border dark:border-slate-700 mt-auto sm:mt-0">
                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 dark:bg-slate-900 dark:border-slate-700">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">{t('edit_operator_modal_title')}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && <div className="p-3 bg-red-50 text-red-700 text-sm rounded flex items-center gap-2 dark:bg-red-900/20 dark:text-red-300">
                        <ShieldAlert className="w-4 h-4" /> {error}
                    </div>}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('email_read_only')}</label>
                        <input value={operator.email} disabled className="w-full p-3 sm:p-2 min-h-[44px] border border-slate-200 bg-slate-50 rounded focus:outline-none text-slate-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-300" />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_full_name')}</label>
                        <input name="full_name" value={formData.full_name} onChange={handleChange} className="w-full p-3 sm:p-2 min-h-[44px] border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 dark:text-slate-300">{t('label_booth_id')}</label>
                        <input name="booth_id" value={formData.booth_id} onChange={handleChange} className="w-full p-3 sm:p-2 min-h-[44px] border rounded focus:ring-2 focus:ring-janmat-blue outline-none dark:bg-slate-700 dark:border-slate-600 dark:text-white" required />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="is_active"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleChange}
                            className="w-5 h-5 sm:w-4 sm:h-4 text-janmat-blue border-gray-300 rounded focus:ring-janmat-blue dark:bg-slate-700 dark:border-slate-600"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-slate-700 dark:text-slate-300 flex-1 py-3 sm:py-0">{t('label_active_account')}</label>
                    </div>

                    <div className="pt-4 pb-8 sm:pb-0 flex flex-col sm:flex-row justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-3 sm:py-2 min-h-[44px] text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200 sm:border-transparent font-medium dark:text-slate-300 dark:hover:bg-slate-700">{t('cancel')}</button>
                        <button type="submit" disabled={loading} className="px-4 py-3 sm:py-2 min-h-[44px] bg-janmat-blue text-white rounded-lg font-bold hover:bg-janmat-hover disabled:opacity-50">
                            {loading ? t('btn_saving') : t('btn_save_changes')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OperatorList;
