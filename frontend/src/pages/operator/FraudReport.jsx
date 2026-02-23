import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import {
    ArrowLeft, Shield, AlertTriangle, CheckCircle2,
    Loader2, Lock
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import Breadcrumbs from '../../components/common/Breadcrumbs';

const getFraudTypes = (t) => [
    { value: 'suspicious_activity', label: t('fraud_type_suspicious') },
    { value: 'impersonation', label: t('fraud_type_impersonation') },
    { value: 'technical_issue', label: t('fraud_type_technical') },
    { value: 'unauthorized_access', label: t('fraud_type_unauthorized') },
    { value: 'duplicate_biometric', label: t('fraud_type_duplicate') },
    { value: 'already_voted', label: t('fraud_type_already_voted') },
    { value: 'other', label: t('fraud_type_other') },
];

const FraudReport = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [form, setForm] = useState({
        fraud_type: '',
        aadhaar_number: '',
        description: '',
        severity: 'medium',
    });

    const boothId = user?.booth_id || '—';

    const handleChange = (field, value) => setForm(p => ({ ...p, [field]: value }));

    const formatAadhaar = (v) => {
        const d = v.replace(/\D/g, '').slice(0, 12);
        return d.replace(/(\d{4})(?=\d)/g, '$1 ');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.fraud_type) { toast.error('Select an incident type.'); return; }
        if (!form.description.trim()) { toast.error('Provide a description of the incident.'); return; }

        setLoading(true);
        try {
            await axios.post('/fraud/report/', {
                fraud_type: form.fraud_type,
                aadhaar_number: form.aadhaar_number.replace(/\s/g, ''),
                description: form.description,
                severity: form.severity,
            });
            setSubmitted(true);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to submit report. Please retry or contact administrator.');
        } finally { setLoading(false); }
    };

    const operatorName = user?.full_name || user?.name || 'Operator';

    // Header
    const Header = () => (
        <>
            <div className="h-1.5 w-full flex">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-[#138808]" />
            </div>
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <img src="/assets/images/ashoka-black.png" alt="Emblem" className="w-8 h-8 object-contain"
                            onError={e => { e.target.src = 'https://placehold.co/32x32?text=🏛️'; }} />
                        <div className="border-l border-slate-200 pl-3">
                            <p className="text-sm font-bold text-slate-800">{operatorName} — Booth {boothId}</p>
                            <p className="text-[10px] text-slate-400">{t('ECI')} — {t('JanMat')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-200">{t('demo')}</span>
                            <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {t('secure')}
                            </span>
                        </div>
                    </div>
                </div>
            </header>
        </>
    );

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#f4f6fa]">
                <Toaster position="top-center" />
                <Header />
                <main className="max-w-xl mx-auto p-6 mt-10">
                    <Breadcrumbs />
                    <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-9 h-9 text-green-600" />
                        </div>
                        <h2 className="text-lg font-bold text-green-800 mb-2">{t('incident_reported_success')}</h2>
                        <p className="text-sm text-slate-600 mb-6">{t('incident_reported_desc')}</p>
                        <div className="flex gap-3">
                            <button onClick={() => navigate('/operator-dashboard')} className="flex-1 py-2.5 bg-janmat-blue text-white font-semibold rounded-lg hover:bg-janmat-hover transition-all text-sm">
                                {t('btn_return_dashboard')}
                            </button>
                            <button onClick={() => { setSubmitted(false); setForm({ fraud_type: '', aadhaar_number: '', description: '', severity: 'medium' }); }}
                                className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-all text-sm">
                                {t('btn_file_another_report')}
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f4f6fa]">
            <Toaster position="top-center" />
            <Header />

            <main className="max-w-2xl mx-auto p-4 sm:p-6 mt-4">
                <Breadcrumbs />
                {/* Back */}
                <button onClick={() => navigate('/operator-dashboard')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors mb-4">
                    <ArrowLeft className="w-4 h-4" /> {t('btn_back_dashboard')}
                </button>

                <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                    {/* Title */}
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-800">{t('title_report_incident')}</h2>
                            <p className="text-[11px] text-slate-500">{t('desc_report_incident')}</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Incident Type */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('label_incident_type')}</label>
                            <select
                                value={form.fraud_type}
                                onChange={e => handleChange('fraud_type', e.target.value)}
                                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:border-janmat-blue focus:ring-1 focus:ring-janmat-blue/30 outline-none transition-all bg-white"
                            >
                                <option value="">{t('select_incident_type')}</option>
                                {getFraudTypes(t).map(f => (
                                    <option key={f.value} value={f.value}>{f.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Severity */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('label_severity')}</label>
                            <div className="flex gap-2">
                                {['low', 'medium', 'high', 'critical'].map(s => (
                                    <button
                                        key={s}
                                        type="button"
                                        onClick={() => handleChange('severity', s)}
                                        className={`flex-1 py-2 rounded-lg border text-xs font-bold capitalize transition-all ${form.severity === s
                                            ? s === 'critical' ? 'bg-red-600 text-white border-red-600'
                                                : s === 'high' ? 'bg-orange-500 text-white border-orange-500'
                                                    : s === 'medium' ? 'bg-amber-500 text-white border-amber-500'
                                                        : 'bg-blue-500 text-white border-blue-500'
                                            : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {t(`severity_${s}`)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Aadhaar */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                {t('label_aadhaar_optional_text')} <span className="text-slate-400 font-normal">{t('label_aadhaar_if_available')}</span>
                            </label>
                            <input
                                type="text"
                                value={formatAadhaar(form.aadhaar_number)}
                                onChange={e => handleChange('aadhaar_number', e.target.value.replace(/\s/g, ''))}
                                placeholder="XXXX XXXX XXXX"
                                maxLength={14}
                                className="w-full px-3 py-2.5 font-mono text-sm tracking-wider border border-slate-300 rounded-lg focus:border-janmat-blue focus:ring-1 focus:ring-janmat-blue/30 outline-none transition-all"
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('label_description')}</label>
                            <textarea
                                value={form.description}
                                onChange={e => handleChange('description', e.target.value)}
                                placeholder={t('placeholder_description')}
                                rows={4}
                                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:border-janmat-blue focus:ring-1 focus:ring-janmat-blue/30 outline-none resize-none transition-all"
                            />
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-amber-700">
                                {t('audit_warning_desc')}
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={!form.fraud_type || !form.description.trim() || loading}
                            className="w-full py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                            {t('btn_submit_incident')}
                        </button>
                    </form>
                </div>

                {/* Security footer */}
                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{t('terminal_audit_footer')}</span>
                </div>
            </main>
        </div>
    );
};

export default FraudReport;
