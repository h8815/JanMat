import React, { useEffect, useState } from 'react';
import axios from '../../api/axios';
import { Plus, Search, RefreshCw, Eye, EyeOff, ShieldAlert, Edit2, Trash2, X } from 'lucide-react';

const OperatorList = () => {
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentOperator, setCurrentOperator] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

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

    const filteredOperators = operators.filter(op =>
        (op.full_name || op.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.booth_id || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
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
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Operator Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Booth ID</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Last Login</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-slate-400">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200 dark:bg-slate-800 dark:divide-slate-700">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center dark:text-slate-400">Loading operators...</td></tr>
                        ) : filteredOperators.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400">No operators found.</td></tr>
                        ) : (
                            filteredOperators.map((op) => (
                                <tr key={op.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
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
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                        {op.last_login ? new Date(op.last_login).toLocaleString() : 'Never'}
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
