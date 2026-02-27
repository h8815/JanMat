import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import {
    CheckCircle2, AlertTriangle, Loader2,
    Shield, ArrowLeft
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import Breadcrumbs from '../../components/common/Breadcrumbs';

/*
 * OPERATOR VOTER VERIFICATION
 * Matches the government-grade Election Commission reference design.
 * Two-column layout: Left = Action, Right = Voter Preview / Confirmation
 * Steps: 1) Aadhaar+OTP  2) Visual+Biometric  3) Done
 */

const VoterVerification = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Phase: 'aadhaar' | 'otp' | 'preview' | 'biometric' | 'done'
    const [phase, setPhase] = useState('aadhaar');
    const [loading, setLoading] = useState(false);

    // Aadhaar + OTP
    const [aadhaar, setAadhaar] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [countdown, setCountdown] = useState(0);
    const [errorCooldown, setErrorCooldown] = useState(0);
    const otpRefs = useRef([]);

    // Voter data from API
    const [voter, setVoter] = useState(null);
    const [visualChecked, setVisualChecked] = useState(false);

    // Biometric
    const [scanState, setScanState] = useState('idle'); // idle | scanning | success | duplicate
    const [duplicateInfo, setDuplicateInfo] = useState(null);

    // Fraud alert
    const [fraudAlert, setFraudAlert] = useState(null);

    const boothId = user?.booth_id || '—';

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setInterval(() => setCountdown(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [countdown]);

    // Error Cooldown timer
    useEffect(() => {
        if (errorCooldown <= 0) return;
        const t = setInterval(() => setErrorCooldown(p => p - 1), 1000);
        return () => clearInterval(t);
    }, [errorCooldown]);

    // ─── AADHAAR ───
    const formatAadhaar = (raw) => {
        const d = raw.replace(/\D/g, '').slice(0, 12);
        return d.replace(/(\d{4})(?=\d)/g, '$1 ');
    };

    const handleSendOTP = async () => {
        const raw = aadhaar.replace(/\s/g, '');
        if (raw.length !== 12) { toast.error('Enter a valid 12-digit Aadhaar number.'); return; }
        setLoading(true);
        try {
            await axios.post('/verification/send-otp/', { aadhaar_number: raw });
            setPhase('otp');
            setCountdown(300);
            toast.success('OTP sent to registered mobile number.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to send OTP. Please retry.');
        } finally { setLoading(false); }
    };

    // ─── OTP ───
    const handleOtpChange = (i, val) => {
        if (!/^\d*$/.test(val)) return;
        const newOtp = [...otp];
        newOtp[i] = val.slice(-1);
        setOtp(newOtp);
        if (val && i < 5) otpRefs.current[i + 1]?.focus();
    };
    const handleOtpKeyDown = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
    };
    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
        setOtp(newOtp);
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    };

    const handleVerifyOTP = async () => {
        const code = otp.join('');
        if (code.length !== 6) { toast.error('Enter the complete 6-digit OTP.'); return; }
        setLoading(true);
        setFraudAlert(null);
        try {
            const res = await axios.post('/verification/verify-otp/', {
                aadhaar_number: aadhaar.replace(/\s/g, ''),
                otp_code: code
            });
            if (res.data.fraud_alert) {
                setVoter(res.data.voter);

                let geoMsg = "";
                if (res.data.voter?.original_location) {
                    const loc = res.data.voter.original_location;
                    geoMsg = ` (Original Registration: State: ${loc.state}, District: ${loc.district}, Tehsil: ${loc.tehsil}, Booth: ${loc.booth_id})`;
                }

                setFraudAlert({ type: 'already_voted', message: `This voter is already marked as 'Voted' in the central system.${geoMsg} This attempt has been logged and flagged for admin review.` });
                setPhase('preview');
                return;
            }
            setVoter(res.data.voter);
            setPhase('preview');
            toast.success('Aadhaar verified. Proceed with visual check.');
        } catch (err) {
            const data = err.response?.data;
            if (data?.fraud_alert) {
                setVoter(data.voter);

                let geoMsg = "";
                if (data.voter?.original_location) {
                    const loc = data.voter.original_location;
                    geoMsg = ` (Original Registration: State: ${loc.state}, District: ${loc.district}, Tehsil: ${loc.tehsil}, Booth: ${loc.booth_id})`;
                }

                setFraudAlert({ type: 'already_voted', message: `This voter is already marked as 'Voted' in the central system.${geoMsg} This attempt has been logged and flagged for admin review.` });
                setPhase('preview');
            } else {
                toast.error(data?.error || 'Invalid OTP. Please retry.');
                setErrorCooldown(30);
                setOtp(['', '', '', '', '', '']);
            }
        } finally { setLoading(false); }
    };

    // ─── BIOMETRIC ───
    const handleProceedBiometric = () => {
        setPhase('biometric');
    };

    const handleStartScan = async () => {
        setScanState('scanning');
        // Simulate scan
        await new Promise(r => setTimeout(r, 2200));
        setLoading(true);
        try {
            const biometricData = `fp_${aadhaar.replace(/\s/g, '')}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const res = await axios.post('/verification/biometric-scan/', {
                biometric_data: biometricData,
                quality_score: Math.floor(Math.random() * 15) + 85
            });
            if (res.data.status === 'fraud') {
                setScanState('duplicate');
                setDuplicateInfo(res.data.existing_voter);
                return;
            }
            setScanState('success');
        } catch (err) {
            setScanState('idle');
            toast.error(err.response?.data?.error || 'Biometric scan failed. Please retry.');
        } finally { setLoading(false); }
    };

    const handleMarkVoted = () => {
        setPhase('done');
        toast.success('Verification Successful. Voter is eligible to proceed to EVM.');
    };

    const handleReset = () => {
        setPhase('aadhaar');
        setAadhaar('');
        setOtp(['', '', '', '', '', '']);
        setCountdown(0);
        setVoter(null);
        setVisualChecked(false);
        setScanState('idle');
        setDuplicateInfo(null);
        setFraudAlert(null);
    };

    // ─── AADHAAR CARD UI ───
    const AadhaarCard = ({ size = 'normal' }) => {
        if (!voter) return null;
        const isSmall = size === 'small';
        return (
            <div className={`border rounded-lg overflow-hidden ${isSmall ? 'border-slate-300' : 'border-slate-200'}`}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
                    <img src="/assets/images/ashoka-black.png" alt="Emblem" className="w-6 h-6 object-contain"
                        onError={e => { e.target.src = 'https://placehold.co/24x24?text=🏛️'; }} />
                    <div className="text-right">
                        <p className="text-[10px] text-orange-600 font-bold leading-tight">{t('govt_of_india_hi')}</p>
                        <p className="text-[9px] text-slate-600 leading-tight">{t('govt_of_india')}</p>
                    </div>
                </div>
                {/* Body */}
                <div className="p-4 bg-white">
                    <div className="flex gap-4 items-center">
                        {/* Photo */}
                        {voter.photo_base64 ? (
                            <img
                                src={`data:image/jpeg;base64,${voter.photo_base64}`}
                                alt="Voter"
                                className="w-20 h-24 rounded object-cover border border-slate-200"
                                loading="lazy"
                                decoding="async"
                            />
                        ) : (
                            <div className="w-20 h-24 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 text-xs">No Photo</div>
                        )}
                        {/* Details */}
                        <div className="flex-1 text-sm space-y-0.5">
                            {voter.full_name_hindi && <p className="font-bold text-slate-800">{voter.full_name_hindi}</p>}
                            <p className="font-bold text-slate-800">{voter.full_name}</p>
                            <p className="text-[10px] text-slate-400">{t('dob_hi')} / {t('dob')}</p>
                            <p className="text-xs text-slate-700">{voter.date_of_birth}</p>
                            <p className="text-[10px] text-slate-400">{t('gender_hi')} / {t('gender')}</p>
                            <p className="text-xs text-slate-700">{voter.gender}</p>
                            <div className="pt-1.5">
                                <p className="text-[10px] text-slate-400 font-semibold mb-0.5 uppercase tracking-wider">{t('address_hi', 'पता')} / {t('address', 'Address')}</p>
                                <p className="text-xs text-slate-700 font-medium leading-tight">{voter.full_address || voter.address || 'Address not available'}</p>
                            </div>
                        </div>
                    </div>
                    {/* Aadhaar Number */}
                    <div className="mt-4 text-center">
                        <p className="text-xl font-bold tracking-[0.25em] text-slate-900 font-mono">
                            {voter.aadhaar_masked || 'XXXX XXXX ****'}
                        </p>
                    </div>
                    {/* Footer */}
                    <div className="mt-2 flex items-center justify-between">
                        <p className="text-[10px] text-red-600 font-semibold">{t('mera_aadhaar')}</p>
                        <img src="https://upload.wikimedia.org/wikipedia/en/thumb/c/cf/Aadhaar_Logo.svg/120px-Aadhaar_Logo.svg.png"
                            alt="Aadhaar" className="h-5 object-contain" onError={e => { e.target.style.display = 'none'; }} loading="lazy" />
                    </div>
                </div>
            </div>
        );
    };

    const operatorName = user?.full_name || user?.name || 'Operator';

    // ─── HEADER (shared across all phases) ───
    const Header = () => (
        <>
            <div className="h-1.5 w-full flex">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white" />
                <div className="flex-1 bg-[#138808]" />
            </div>
            <header className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
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

    // =================================================================
    // PHASE: AADHAAR + OTP  (Left column) + Preview (Right column)
    // =================================================================
    if (phase === 'aadhaar' || phase === 'otp' || phase === 'preview') {
        const hasVoter = !!voter;
        const alreadyVoted = voter?.has_voted || fraudAlert?.type === 'already_voted';
        return (
            <div className="min-h-screen bg-[#f4f6fa]">
                <Toaster position="top-center" />
                <Header />

                <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
                    <Breadcrumbs />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Step 1 - Voter Identification */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-5">
                                <CheckCircle2 className={`w-5 h-5 ${phase !== 'aadhaar' ? 'text-green-500' : 'text-janmat-blue'}`} />
                                <h2 className="text-base font-bold text-slate-800">{t('step_1_title')}</h2>
                            </div>

                            {/* Aadhaar Input */}
                            <label className="block text-sm font-semibold text-slate-700 mb-1.5">{t('label_aadhaar_number')}</label>
                            <div className="flex gap-2 mb-1.5">
                                <input
                                    type="text"
                                    value={formatAadhaar(aadhaar)}
                                    onChange={e => setAadhaar(e.target.value.replace(/\s/g, ''))}
                                    placeholder={t('placeholder_aadhaar')}
                                    maxLength={14}
                                    disabled={phase !== 'aadhaar'}
                                    className="flex-1 px-3 py-2.5 font-mono text-sm tracking-wider border border-slate-300 rounded-lg focus:border-janmat-blue focus:ring-1 focus:ring-janmat-blue/30 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                />
                                <button
                                    onClick={handleSendOTP}
                                    disabled={aadhaar.replace(/\s/g, '').length !== 12 || loading || phase !== 'aadhaar'}
                                    className="px-4 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                >
                                    {t('btn_send_otp')}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 mb-1">{t('aadhaar_note')}</p>
                            <p className="text-[10px] text-blue-500 mb-5">{t('demo_aadhaar_note')}</p>

                            {/* OTP Section */}
                            {(phase === 'otp' || phase === 'preview') && (
                                <>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">{t('label_enter_otp')}</label>
                                    <div className="flex gap-2 mb-2" onPaste={handleOtpPaste}>
                                        {otp.map((d, i) => (
                                            <input
                                                key={i}
                                                ref={el => otpRefs.current[i] = el}
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={1}
                                                value={d}
                                                onChange={e => handleOtpChange(i, e.target.value)}
                                                onKeyDown={e => handleOtpKeyDown(i, e)}
                                                disabled={phase === 'preview' || errorCooldown > 0}
                                                className={`w-10 h-11 text-center text-lg font-bold border rounded-lg focus:ring-1 outline-none transition-all disabled:bg-slate-50 ${errorCooldown > 0 ? 'border-red-300 text-red-500 bg-red-50' : 'border-slate-300 focus:border-janmat-blue focus:ring-janmat-blue/30'}`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <button
                                            onClick={handleVerifyOTP}
                                            disabled={otp.join('').length !== 6 || loading || phase === 'preview' || errorCooldown > 0}
                                            className="px-5 py-2 bg-janmat-blue text-white text-sm font-bold rounded-lg hover:bg-janmat-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('btn_verify_otp')}
                                            {errorCooldown > 0 && <span className="opacity-75">({errorCooldown}s)</span>}
                                        </button>
                                        <button
                                            onClick={() => { setPhase('aadhaar'); setOtp(['', '', '', '', '', '']); setCountdown(0); setErrorCooldown(0); }}
                                            disabled={phase === 'preview' || errorCooldown > 0}
                                            className="px-4 py-2 border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                        >
                                            {t('btn_resend')}
                                        </button>
                                    </div>
                                    {errorCooldown > 0 && (
                                        <p className="text-xs font-bold text-red-500 mb-2 animate-pulse">Too many failed attempts. Please wait {errorCooldown} seconds.</p>
                                    )}
                                    <p className="text-[11px] text-slate-400 mb-1">
                                        {t('otp_sent_to')}{aadhaar.replace(/\s/g, '').slice(-4)}
                                        {countdown > 0 && <span className="ml-2 text-amber-600 font-mono">({Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')})</span>}
                                    </p>
                                    <p className="text-[10px] text-blue-500 mb-5">{t('demo_otp_note')}</p>
                                </>
                            )}

                            {/* Security Notice */}
                            <div className="flex items-start gap-3 pt-4 border-t border-slate-100">
                                <Shield className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                                <div>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase">{t('security_notice_title')}</p>
                                    <p className="text-[10px] text-slate-400">{t('security_notice_desc')}</p>
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Step 2 - Voter Preview & Visual Check */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-base font-bold text-slate-800 mb-5">{t('step_2_title')}</h2>

                            {hasVoter ? (
                                <>
                                    <AadhaarCard />

                                    {/* Voter Status */}
                                    <div className="mt-4 text-center">
                                        <span className="text-sm text-slate-500">{t('voter_status')}</span>
                                        {alreadyVoted ? (
                                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">{t('status_voted')}</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">{t('status_eligible')}</span>
                                        )}
                                    </div>

                                    {/* Visual Check */}
                                    {!alreadyVoted && (
                                        <>
                                            <label className="mt-4 flex items-start gap-2.5 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={visualChecked}
                                                    onChange={e => setVisualChecked(e.target.checked)}
                                                    className="mt-0.5 h-4 w-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                                                />
                                                <span className="text-sm text-slate-700">{t('visual_verify_checkbox')}</span>
                                            </label>

                                            <button
                                                onClick={handleProceedBiometric}
                                                disabled={!visualChecked}
                                                className="mt-4 w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm"
                                            >
                                                {t('btn_proceed_biometric')}
                                            </button>
                                        </>
                                    )}

                                    {/* Fraud alert */}
                                    {fraudAlert && (
                                        <div className="mt-4">
                                            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg mb-4">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <AlertTriangle className="w-4 h-4 text-red-600" />
                                                    <p className="text-sm font-bold text-red-700">{t('fraud_alert_title')}</p>
                                                </div>
                                                <p className="text-xs text-red-600">{fraudAlert.message}</p>
                                            </div>
                                            <button
                                                onClick={handleReset}
                                                className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all shadow-sm"
                                            >
                                                Mark as Fraud & Start Over
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-64 text-slate-300">
                                    <p className="text-sm">{t('no_voter_details')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Back button */}
                    <button onClick={() => navigate('/operator-dashboard')} className="mt-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> {t('btn_back_dashboard')}
                    </button>
                </main>
            </div>
        );
    }

    // =================================================================
    // PHASE: BIOMETRIC
    // =================================================================
    if (phase === 'biometric') {
        return (
            <div className="min-h-screen bg-[#f4f6fa]">
                <Toaster position="top-center" />
                <Header />

                <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Step 3 - Biometric Verification */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 className="w-5 h-5 text-green-500" />
                                <h2 className="text-base font-bold text-slate-800">{t('step_3_title')}</h2>
                            </div>
                            <p className="text-sm text-slate-500 mb-6">
                                {t('biometric_instruction')}
                            </p>

                            {/* Scanner Area */}
                            <div className={`
                                rounded-xl h-48 flex flex-col items-center justify-center transition-all duration-500
                                ${scanState === 'idle' ? 'bg-slate-800 text-slate-300' :
                                    scanState === 'scanning' ? 'bg-slate-800 text-blue-400' :
                                        scanState === 'success' ? 'bg-green-800 text-green-300' :
                                            'bg-red-900 text-red-300'}
                            `}>
                                {scanState === 'idle' && <p className="text-sm font-medium">{t('scan_waiting')}</p>}
                                {scanState === 'scanning' && (
                                    <>
                                        <Loader2 className="w-10 h-10 animate-spin mb-2" />
                                        <p className="text-sm font-medium">{t('scan_scanning')}</p>
                                    </>
                                )}
                                {scanState === 'success' && (
                                    <>
                                        <CheckCircle2 className="w-12 h-12 text-green-400 mb-2" />
                                        <p className="text-sm font-bold">{t('scan_success')}</p>
                                    </>
                                )}
                                {scanState === 'duplicate' && (
                                    <>
                                        <AlertTriangle className="w-12 h-12 text-red-400 mb-2" />
                                        <p className="text-sm font-bold">{t('scan_duplicate_detected')}</p>
                                    </>
                                )}
                            </div>

                            {/* Buttons */}
                            <div className="flex gap-3 mt-4">
                                {scanState === 'idle' && (
                                    <>
                                        <button
                                            onClick={handleStartScan}
                                            className="px-5 py-2.5 bg-janmat-blue text-white text-sm font-bold rounded-lg hover:bg-janmat-hover transition-all"
                                        >
                                            {t('btn_start_scan')}
                                        </button>
                                        <button
                                            onClick={() => setPhase('preview')}
                                            className="px-5 py-2.5 border border-slate-300 text-slate-600 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-all"
                                        >
                                            {t('btn_cancel_back')}
                                        </button>
                                    </>
                                )}
                                {scanState === 'success' && (
                                    <button
                                        onClick={handleMarkVoted}
                                        className="w-full py-3 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-all"
                                    >
                                        {t('btn_mark_voted')}
                                    </button>
                                )}
                                {scanState === 'duplicate' && (
                                    <button
                                        onClick={handleReset}
                                        className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-all"
                                    >
                                        Mark as Fraud & Start Over
                                    </button>
                                )}
                            </div>

                            {/* Note */}
                            <p className="mt-4 text-[10px] text-slate-400">
                                {t('biometric_note')}
                            </p>
                        </div>

                        {/* RIGHT: Final Confirmation Card */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-base font-bold text-slate-800 mb-5">{t('final_confirmation_title')}</h2>
                            <AadhaarCard />

                            <div className="mt-4 bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-lg">
                                <p className="text-xs text-amber-700">
                                    {t('visual_confirm_warning')}
                                </p>
                            </div>

                            {scanState === 'duplicate' && duplicateInfo && (
                                <div className="mt-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-r-lg">
                                    <p className="text-sm font-bold text-red-700 mb-1">{t('duplicate_biometric_alert')}</p>
                                    <p className="text-xs text-red-600 mb-2">
                                        {t('duplicate_biometric_desc')}
                                    </p>
                                    {duplicateInfo.original_location && (
                                        <div className="bg-white/60 p-2 rounded text-[10px] text-red-800 border border-red-200">
                                            <p className="font-semibold mb-1 border-b border-red-200 pb-0.5">Original Registration Found:</p>
                                            <div className="grid grid-cols-2 gap-1">
                                                <p><span className="text-red-600 font-medium">State:</span> {duplicateInfo.original_location.state}</p>
                                                <p><span className="text-red-600 font-medium">District:</span> {duplicateInfo.original_location.district}</p>
                                                <p><span className="text-red-600 font-medium">Tehsil:</span> {duplicateInfo.original_location.tehsil}</p>
                                                <p><span className="text-red-600 font-medium">Booth:</span> {duplicateInfo.original_location.booth_id}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <button onClick={() => setPhase('preview')} className="mt-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors">
                        <ArrowLeft className="w-4 h-4" /> {t('btn_back_visual')}
                    </button>
                </main>
            </div>
        );
    }

    // =================================================================
    // PHASE: DONE
    // =================================================================
    return (
        <div className="min-h-screen bg-[#f4f6fa]">
            <Toaster position="top-center" />
            <Header />

            <main className="max-w-xl mx-auto p-6 mt-10">
                <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm text-center">
                    <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
                        <CheckCircle2 className="w-12 h-12 text-green-600" />
                    </div>
                    <h2 className="text-xl font-bold text-green-800 mb-2">{t('verification_successful')}</h2>
                    <p className="text-sm text-slate-600 mb-6">
                        {t('verification_success_desc')}
                    </p>

                    {voter && (
                        <div className="text-left bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-sm space-y-1.5">
                            <div className="flex justify-between">
                                <span className="text-slate-500">{t('label_name')}</span>
                                <span className="font-bold text-slate-800">{i18n.language === 'hi' && voter.full_name_hindi ? voter.full_name_hindi : voter.full_name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">{t('label_aadhaar_number').split(' ')[0]}</span>
                                <span className="font-mono text-slate-800">{voter.aadhaar_masked}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={handleReset}
                            className="flex-1 py-3 bg-janmat-blue text-white font-bold rounded-lg hover:bg-janmat-hover transition-all text-sm"
                        >
                            {t('verify_next_voter')}
                        </button>
                        <button
                            onClick={() => navigate('/operator-dashboard')}
                            className="flex-1 py-3 border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-50 transition-all text-sm"
                        >
                            {t('btn_return_dashboard')}
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                    <Shield className="w-3.5 h-3.5" />
                    <span>{t('verification_audit_note')}</span>
                </div>
            </main>
        </div>
    );
};

export default VoterVerification;
