import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../api/axios';
import {
    CheckCircle2, AlertTriangle, Loader2,
    Shield, ArrowLeft, User, Fingerprint, Activity
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import FontSizeSwitcher from '../../components/common/FontSizeSwitcher';
import SystemStatus from '../../components/common/SystemStatus';
import Breadcrumbs from '../../components/common/Breadcrumbs';

/*
 * OPERATOR VOTER VERIFICATION
 * Matches the government-grade Election Commission reference design.
 * Two-column layout: Left = Action, Right = Voter Preview / Confirmation
 * Steps: 1) Aadhaar+OTP  2) Visual+Biometric  3) Done
 */

// ─── HEADER COMPONENT (Extracted to prevent remounts) ───
const VerificationHeader = ({ operatorName, boothId, t, user, hardwareStatus }) => (
    <>
        <div className="h-1.5 w-full flex">
            <div className="flex-1 bg-[#FF9933]" />
            <div className="flex-1 bg-white" />
            <div className="flex-1 bg-[#138808]" />
        </div>
        <header className="bg-white border-b border-slate-200 shadow-sm relative z-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <img src="/assets/images/ashoka-black.png" alt="Emblem" className="w-8 h-8 object-contain"
                        onError={e => { e.target.src = 'https://placehold.co/32x32?text=🏛️'; }} />
                    <div className="border-l border-slate-200 pl-3">
                        <p className="text-sm font-bold text-slate-800">{operatorName} — Booth {boothId}</p>
                        <p className="text-[10px] text-slate-400">{t('ECI')} — {t('JanMat')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                    <div className="hidden md:flex flex-col items-end mr-4">
                        <span className="text-[10px] text-slate-400 font-medium">Last Login</span>
                        <span className="text-xs text-slate-600 font-semibold">{user?.last_login ? new Date(user.last_login).toLocaleString() : 'Just now'}</span>
                    </div>
                    <span className="hidden sm:block"><SystemStatus biometricStatus={hardwareStatus} /></span>
                    <span className="hidden sm:block"><FontSizeSwitcher /></span>
                    <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                    <LanguageSwitcher />
                    <div className="flex items-center gap-2">
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
    const [scanState, setScanState] = useState('idle'); // idle | scanning | success | duplicate | failed | timeout
    const [hardwareStatus, setHardwareStatus] = useState('Offline');
    const [duplicateInfo, setDuplicateInfo] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    const [scanError, setScanError] = useState('');
    const scanTimeoutRef = useRef(null);

    // Simulate Hardware Connection on component mount
    useEffect(() => {
        const timer1 = setTimeout(() => setHardwareStatus('Connected'), 1200);
        const timer2 = setTimeout(() => setHardwareStatus('Ready'), 2800);
        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(scanTimeoutRef.current); };
    }, []);

    // Fraud alert
    const [fraudAlert, setFraudAlert] = useState(null);

    // Already-voted early warning (shown as soon as Aadhaar is entered)
    const [alreadyVotedWarning, setAlreadyVotedWarning] = useState(false);

    // Rate Limiting States
    const [otpAttempts, setOtpAttempts] = useState(0);

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
        setAlreadyVotedWarning(false);
        try {
            const res = await axios.post('/verification/send-otp/', { aadhaar_number: raw });
            // Check for already-voted warning from backend
            if (res.data.already_voted_warning) {
                setAlreadyVotedWarning(true);
            }
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

        // Auto-focus next
        if (val && i < 5) {
            otpRefs.current[i + 1]?.focus();
        }

        // Auto-submit if last digit is entered
        if (newOtp.join('').length === 6) {
            // Must use a micro-delay to allow React state to settle before firing API
            setTimeout(() => handleVerifyOTP(newOtp.join('')), 50);
        }
    };

    const handleOtpKeyDown = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) {
            otpRefs.current[i - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        const newOtp = [...otp];
        for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
        setOtp(newOtp);
        otpRefs.current[Math.min(pasted.length, 5)]?.focus();

        // Auto-submit on paste if full 6 digits
        if (newOtp.join('').length === 6) {
            setTimeout(() => handleVerifyOTP(newOtp.join('')), 50);
        }
    };

    // Pass explicitCode parameter to handle async React state batching issues during auto-submit
    const handleVerifyOTP = async (eOrExplicitCode = null) => {
        // Prevent event object from being assigned as the string code
        const code = typeof eOrExplicitCode === 'string' ? eOrExplicitCode : otp.join('');
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

                setFraudAlert({
                    type: 'already_voted',
                    message: `This voter is already marked as 'Voted' in the central system. This attempt has been logged and flagged for admin review.`,
                    originalLocation: res.data.voter?.original_location
                });
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

                setFraudAlert({
                    type: 'already_voted',
                    message: `This voter is already marked as 'Voted' in the central system. This attempt has been logged and flagged for admin review.`,
                    originalLocation: data.voter?.original_location
                });
                setPhase('preview');
            } else {
                toast.error(data?.error || 'Invalid OTP. Please retry.');

                if (data?.error?.includes('Maximum attempts')) {
                    setOtpAttempts(3); // Lock the UI
                } else {
                    setOtpAttempts(prev => prev + 1);
                }

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
        if (hardwareStatus !== 'Ready') {
            toast.error('Hardware is not ready. Please wait for device initialisation.');
            return;
        }
        if (retryCount >= 3) {
            toast.error('Maximum scan attempts reached. Please contact the supervisor.');
            return;
        }

        setScanState('scanning');
        setScanError('');

        let isTimedOut = false;
        // Hard 8-second timeout → Unable to Detect
        scanTimeoutRef.current = setTimeout(() => {
            isTimedOut = true;
            setScanState('timeout');
            setScanError('Unable to Detect');
            setRetryCount(prev => prev + 1);
            setLoading(false);
        }, 8000);

        // Random scan duration: 5000–8000ms
        const scanDuration = Math.floor(Math.random() * 3001) + 5000;
        await new Promise(r => setTimeout(r, scanDuration));

        if (isTimedOut) return;

        clearTimeout(scanTimeoutRef.current);

        setLoading(true);
        try {
            const biometricData = `fp_${aadhaar.replace(/\s/g, '')}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const res = await axios.post('/verification/biometric-scan/', {
                biometric_data: biometricData
            });
            if (res.data.status === 'fraud') {
                setScanState('duplicate');
                setDuplicateInfo(res.data.existing_voter);
                return;
            }
            setScanState('success');
        } catch (err) {
            const msg = err.response?.data?.error || 'Biometric scan failed.';
            setScanError(msg);
            setScanState('failed');
            setRetryCount(prev => prev + 1);
        } finally { setLoading(false); }
    };

    const handleRetryScan = () => {
        setScanState('idle');
        setScanError('');
    };

    const handleMarkVoted = () => {
        setPhase('done');
        toast.success('Verification Successful. Voter is eligible to proceed to EVM.');
    };

    const handleReset = () => {
        setPhase('aadhaar');
        setAadhaar('');
        setOtp(['', '', '', '', '', '']);
        setOtpAttempts(0);
        setCountdown(0);
        setVoter(null);
        setVisualChecked(false);
        setScanState('idle');
        setScanError('');
        setRetryCount(0);
        setDuplicateInfo(null);
        setFraudAlert(null);
        clearTimeout(scanTimeoutRef.current);
    };

    // ─── AADHAAR CARD UI ───
    const renderAadhaarCard = (size = 'normal') => {
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
                        <div className="flex flex-col">
                            <p className="text-[10px] text-red-600 font-semibold">{t('mera_aadhaar')}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                                <Shield className="w-3 h-3 text-green-600" />
                                <span className="text-[9px] font-bold text-green-700 tracking-wide uppercase">Verified by ECI</span>
                            </div>
                        </div>
                        <img src="https://upload.wikimedia.org/wikipedia/en/thumb/c/cf/Aadhaar_Logo.svg/120px-Aadhaar_Logo.svg.png"
                            alt="Aadhaar" className="h-5 object-contain" onError={e => { e.target.style.display = 'none'; }} loading="lazy" />
                    </div>
                </div>
            </div>
        );
    };

    const operatorName = user?.full_name || user?.name || 'Operator';

    // =================================================================
    // PHASE: AADHAAR + OTP  (Left column) + Preview (Right column)
    // =================================================================
    if (phase === 'aadhaar' || phase === 'otp' || phase === 'preview') {
        const hasVoter = !!voter;
        const alreadyVoted = voter?.has_voted || fraudAlert?.type === 'already_voted';
        return (
            <div className="min-h-screen bg-[#f4f6fa] flex flex-col items-stretch">
                <Toaster position="top-center" />
                <VerificationHeader operatorName={operatorName} boothId={boothId} t={t} user={user} hardwareStatus={hardwareStatus} />

                <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
                    <Breadcrumbs />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Step 1 - Voter Identification */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <div className="flex items-center gap-2 mb-5">
                                <CheckCircle2 className={`w-5 h-5 ${phase !== 'aadhaar' ? 'text-green-500' : 'text-janmat-blue'}`} />
                                <h2 className="text-lg sm:text-xl font-bold text-slate-800">{t('step_1_title')}</h2>
                            </div>

                            {/* Aadhaar Input */}
                            <label className="block text-base font-semibold text-slate-700 mb-1.5">{t('label_aadhaar_number')}</label>
                            <div className="flex gap-2 mb-1.5">
                                <input
                                    type="text"
                                    value={formatAadhaar(aadhaar)}
                                    onChange={e => setAadhaar(e.target.value.replace(/\s/g, ''))}
                                    placeholder={t('placeholder_aadhaar')}
                                    maxLength={14}
                                    disabled={phase !== 'aadhaar'}
                                    className="flex-1 px-4 py-3 font-mono text-base tracking-widest border border-slate-300 rounded-lg focus:border-janmat-blue focus:ring-1 focus:ring-janmat-blue/30 outline-none transition-all disabled:bg-slate-50 disabled:text-slate-500"
                                />
                                <button
                                    onClick={handleSendOTP}
                                    disabled={aadhaar.replace(/\s/g, '').length !== 12 || loading || phase !== 'aadhaar'}
                                    className="px-4 py-2.5 bg-orange-500 text-white text-sm font-bold rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                                >
                                    {t('btn_send_otp')}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 mb-3">{t('aadhaar_note')}</p>

                            {/* Already Voted Warning Banner */}
                            {alreadyVotedWarning && (
                                <div className="mb-5 p-3 bg-red-50 border-2 border-red-300 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0 animate-pulse" />
                                    <div>
                                        <p className="text-sm font-bold text-red-700">{t('already_voted_warning_title') || '⚠️ Already Voted'}</p>
                                        <p className="text-xs text-red-600 mt-1">
                                            {t('already_voted_warning_desc') || 'This Aadhaar number belongs to a voter who has already been marked as "Voted" in the system. This attempt is being logged and flagged for admin review.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* OTP Section */}
                            {(phase === 'otp' || phase === 'preview') && (
                                <div className="mt-6 animate-in fade-in duration-300">
                                    <label className="block text-base font-semibold text-slate-700 mb-3">{t('label_enter_otp')}</label>
                                    <div className="flex gap-2 sm:gap-3 mb-4" onPaste={handleOtpPaste}>
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
                                                disabled={phase === 'preview' || errorCooldown > 0 || otpAttempts >= 3}
                                                className={`w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-black border rounded-xl focus:ring-2 outline-none transition-all disabled:bg-slate-50 ${(errorCooldown > 0 || otpAttempts >= 3) ? 'border-red-300 text-red-500 bg-red-50' : 'border-slate-300 focus:border-janmat-blue focus:ring-janmat-blue/30'}`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <button
                                            onClick={handleVerifyOTP}
                                            disabled={otp.join('').length !== 6 || loading || phase === 'preview' || errorCooldown > 0 || otpAttempts >= 3}
                                            className={`px-5 py-2 text-white text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${otpAttempts >= 3 ? 'bg-red-500 opacity-60 cursor-not-allowed' : 'bg-janmat-blue hover:bg-janmat-hover disabled:opacity-40 disabled:cursor-not-allowed'}`}
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                                                otpAttempts >= 3 ? 'Max Attempts Reached' : t('btn_verify_otp')
                                            )}
                                            {errorCooldown > 0 && otpAttempts < 3 && <span className="opacity-75">({errorCooldown}s)</span>}
                                        </button>
                                        <button
                                            onClick={() => { setPhase('aadhaar'); setOtp(['', '', '', '', '', '']); setCountdown(0); setErrorCooldown(0); setOtpAttempts(0); }}
                                            disabled={phase === 'preview' || (errorCooldown > 0 && otpAttempts < 3)}
                                            className={`px-4 py-2 border text-sm font-semibold rounded-lg transition-all ${otpAttempts >= 3 ? 'bg-orange-500 border-orange-600 text-white hover:bg-orange-600 shadow-sm animate-pulse' : 'border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'}`}
                                        >
                                            {otpAttempts >= 3 ? 'Max Attempts Reached - Resend OTP' : t('btn_resend')}
                                        </button>
                                    </div>

                                    {otpAttempts >= 3 ? (
                                        <p className="text-xs font-bold text-red-600 mb-2 p-2 bg-red-50 border border-red-200 rounded">Maximum attempts exceeded. Verification blocked. Please resend a new OTP.</p>
                                    ) : errorCooldown > 0 ? (
                                        <p className="text-xs font-bold text-red-500 mb-2 animate-pulse">Incorrect code. Please wait {errorCooldown} seconds to try again.</p>
                                    ) : null}
                                    <p className="text-xs text-slate-500 mb-5">
                                        {t('otp_sent_to')} <span className="font-bold tracking-wider">{aadhaar.replace(/\s/g, '').slice(-4)}</span>
                                        {countdown > 0 && <span className="ml-2 text-amber-600 font-mono font-bold">({Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')})</span>}
                                    </p>
                                </div>
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
                        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-sm">
                            <h2 className="text-lg sm:text-xl font-bold text-slate-800 mb-6">{t('step_2_title')}</h2>

                            {hasVoter ? (
                                <>
                                    {renderAadhaarCard('normal')}

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
                                                <p className="text-xs text-red-600 mb-2">{fraudAlert.message}</p>
                                                {fraudAlert.originalLocation && (
                                                    <div className="bg-white/60 p-2 rounded text-[10px] text-red-800 border border-red-200 mt-2">
                                                        <p className="font-semibold mb-1 border-b border-red-200 pb-0.5">Original Registration Found:</p>
                                                        <div className="grid grid-cols-2 gap-1">
                                                            <p><span className="text-red-600 font-medium">State:</span> {fraudAlert.originalLocation.state}</p>
                                                            <p><span className="text-red-600 font-medium">District:</span> {fraudAlert.originalLocation.district}</p>
                                                            <p><span className="text-red-600 font-medium">Tehsil:</span> {fraudAlert.originalLocation.tehsil}</p>
                                                            <p><span className="text-red-600 font-medium">Booth:</span> {fraudAlert.originalLocation.booth_id}</p>
                                                        </div>
                                                    </div>
                                                )}
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
            <div className="min-h-screen bg-[#f3f4f6] flex flex-col items-stretch">
                <Toaster position="top-center" />
                <VerificationHeader operatorName={operatorName} boothId={boothId} t={t} user={user} hardwareStatus={hardwareStatus} />

                <main className="max-w-6xl mx-auto p-4 sm:p-6 mt-4">
                    {/* Top Navigation Progress Bar */}
                    <div className="mb-8 max-w-3xl mx-auto">
                        <div className="flex items-center justify-between relative">
                            {/* Track */}
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10"></div>
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-1 bg-[#6D28D9] -z-10 transition-all duration-500"></div>

                            {/* Step 1 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#6D28D9] text-white flex items-center justify-center font-bold text-sm">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <span className="text-xs font-bold text-slate-700">1. Voter Identification</span>
                            </div>

                            {/* Step 2 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#6D28D9] text-white flex items-center justify-center font-bold text-sm ring-4 ring-[#6D28D9]/20">
                                    2
                                </div>
                                <span className="text-xs font-bold text-[#6D28D9]">2. Biometric Verification</span>
                            </div>

                            {/* Step 3 */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm">
                                    3
                                </div>
                                <span className="text-xs font-semibold text-slate-500">3. Final Confirmation</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* LEFT MODULE: Rugged Hardware Terminal */}
                        <div className="bg-[#1e2433] rounded-sm border border-slate-700 shadow-xl overflow-hidden flex flex-col relative">
                            {/* Hardware details: Screws */}
                            <div className="absolute top-3 left-3 w-1.5 h-1.5 rounded-full bg-[#0f1219] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"></div>
                            <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-[#0f1219] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"></div>
                            <div className="absolute bottom-3 left-3 w-1.5 h-1.5 rounded-full bg-[#0f1219] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"></div>
                            <div className="absolute bottom-3 right-3 w-1.5 h-1.5 rounded-full bg-[#0f1219] shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]"></div>

                            {/* Terminal Top Bar */}
                            <div className="bg-[#181d29] px-5 py-3 border-b border-slate-700/50 flex items-center justify-between z-10">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-2 h-6 bg-slate-600 rounded-sm"></div>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-200 tracking-wider uppercase">ECI Secure Scanner</h2>
                                        <p className="text-[9px] text-slate-500 font-mono tracking-widest uppercase">ID: TERM-74A-99</p>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0f1219] border border-slate-700/50 shadow-inner`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${hardwareStatus === 'Ready' ? 'bg-[#22c55e] shadow-[0_0_5px_#22c55e]' :
                                        hardwareStatus === 'Connected' ? 'bg-[#eab308] shadow-[0_0_5px_#eab308]' : 'bg-[#64748b]'
                                        }`} />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{hardwareStatus}</span>
                                </div>
                            </div>

                            <div className="p-6 flex flex-col flex-1 z-10">
                                {/* Physical Scanner Window & Grayscale Fingerprint */}
                                <div className="relative w-full h-64 bg-[#050608] rounded-lg border-2 border-slate-800 shadow-[inset_0_10px_30px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col items-center justify-center mb-5 mx-auto">
                                    {/* GIF or Icons */}
                                    <div className="relative flex items-center justify-center w-full h-full">
                                        {scanState === 'scanning' ? (
                                            <img
                                                src="/assets/images/fingerprint-animated.gif"
                                                alt="Scanning Biometrics"
                                                className="absolute inset-0 w-full h-full object-cover mix-blend-screen opacity-100"
                                            />
                                        ) : scanState === 'idle' ? (
                                            <Fingerprint className="w-24 h-24 text-slate-700 opacity-20" />
                                        ) : scanState === 'success' ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <CheckCircle2 className="w-20 h-20 text-green-500 drop-shadow-[0_0_15px_rgba(34,197,94,0.8)]" />
                                                <span className="mt-3 text-green-500 font-bold tracking-widest text-sm">MATCHED</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center">
                                                <AlertTriangle className="w-20 h-20 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
                                                <span className="mt-3 text-red-500 font-bold tracking-widest text-sm uppercase">
                                                    {scanState === 'timeout' ? 'Timeout' : scanState === 'duplicate' ? 'Duplicate' : 'Failed'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Glass reflection */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none rounded-lg"></div>
                                </div>

                                {/* Terminal Log Box */}
                                <div className="bg-[#0b0e14] rounded-md border border-slate-700 shadow-inner p-3 h-24 overflow-y-auto mb-6 flex flex-col justify-end">
                                    <div className="font-mono text-[11px] leading-relaxed tracking-wide">
                                        <p className="text-slate-500">[{new Date().toLocaleTimeString('en-US', { hour12: false })}] SYSTEM BOOT VER 4.2.1</p>
                                        {hardwareStatus === 'Connected' && <p className="text-slate-400">[{new Date().toLocaleTimeString('en-US', { hour12: false })}] PROBING USB PORT 2...</p>}
                                        {hardwareStatus === 'Ready' && (
                                            <>
                                                <p className="text-[#22c55e]">[{new Date().toLocaleTimeString('en-US', { hour12: false })}] DEVICE CONNECTED. SENSOR OK.</p>
                                                {scanState === 'idle' && <p className="text-[#22c55e] font-bold mt-1">&gt; SYSTEM READY. AWAITING FINGERPRINT.</p>}
                                            </>
                                        )}
                                        {scanState === 'scanning' && <p className="text-[#22c55e] animate-pulse">&gt; EXECUTING BIOMETRIC CAPTURE...</p>}
                                        {scanState === 'success' && <p className="text-[#22c55e] font-bold mt-1">&gt; MATCH FOUND. VERICIATION SUCCESSFUL.</p>}
                                        {scanState === 'timeout' && <p className="text-red-400 font-bold mt-1">&gt; ERROR: SCAN TIMEOUT. UNABLE TO DETECT.</p>}
                                        {scanState === 'failed' && <p className="text-red-400 font-bold mt-1">&gt; ERROR: MATCH FAILED OR DATA CORRUPT.</p>}
                                        {scanState === 'duplicate' && <p className="text-red-400 font-bold mt-1">&gt; ALERT: DUPLICATE BIOMETRIC DETECTED.</p>}
                                    </div>
                                </div>

                                {/* Start Scan / Actions */}
                                <div className="mt-auto">
                                    {scanState === 'idle' && (
                                        <button
                                            onClick={handleStartScan}
                                            disabled={hardwareStatus !== 'Ready' || retryCount >= 3}
                                            className="w-full py-3.5 bg-[#6D28D9] text-white text-sm font-bold tracking-widest rounded-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#5B21B6]"
                                        >
                                            {hardwareStatus === 'Ready' ? 'START SCAN' : 'INITIALIZING...'}
                                        </button>
                                    )}

                                    {scanState === 'scanning' && (
                                        <button
                                            disabled
                                            className="w-full py-3.5 bg-[#4c1d95] text-indigo-200 text-sm font-bold tracking-widest rounded-sm cursor-wait"
                                        >
                                            SCANNING...
                                        </button>
                                    )}

                                    {scanState === 'success' && (
                                        <button
                                            onClick={handleMarkVoted}
                                            className="w-full py-3.5 bg-[#16a34a] text-white text-sm font-bold tracking-widest rounded-sm transition-all hover:bg-[#15803d]"
                                        >
                                            CONFIRM & MARK VOTED
                                        </button>
                                    )}

                                    {['timeout', 'failed'].includes(scanState) && (
                                        <div className="flex gap-3">
                                            {retryCount < 3 ? (
                                                <button
                                                    onClick={handleRetryScan}
                                                    className="flex-1 py-3.5 bg-[#6D28D9] text-white text-sm font-bold tracking-widest rounded-sm transition-all hover:bg-[#5B21B6]"
                                                >
                                                    RETAKE SCAN ({3 - retryCount} LEFT)
                                                </button>
                                            ) : (
                                                <button disabled className="flex-1 py-3.5 bg-red-900/50 text-red-500 text-sm font-bold tracking-widest rounded-sm border border-red-900">
                                                    MAX ATTEMPTS
                                                </button>
                                            )}
                                            <button
                                                onClick={handleReset}
                                                className="px-6 py-3.5 bg-transparent border border-slate-600 text-slate-300 text-sm font-bold tracking-widest rounded-sm hover:bg-slate-800 transition-colors"
                                            >
                                                CANCEL
                                            </button>
                                        </div>
                                    )}

                                    {scanState === 'duplicate' && (
                                        <button
                                            onClick={handleReset}
                                            className="w-full py-3.5 bg-[#dc2626] text-white text-sm font-bold tracking-widest rounded-sm transition-all hover:bg-[#b91c1c]"
                                        >
                                            FLAG FRAUD & START OVER
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT MODULE: Clean Official ID Profile */}
                        <div className="bg-white rounded-sm border border-slate-200 flex flex-col overflow-hidden h-full">
                            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                                <User className="w-5 h-5 text-slate-800" />
                                <h3 className="font-bold text-slate-900 tracking-wide uppercase text-sm">Voter Profile Preview</h3>
                            </div>

                            <div className="p-6 flex-1 flex flex-col justify-center">
                                {renderAadhaarCard('normal')}

                                {scanState === 'duplicate' && duplicateInfo && (
                                    <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                                        <p className="text-sm font-bold text-red-700 mb-1">{t('duplicate_biometric_alert', 'Duplicate Detected')}</p>
                                        <p className="text-xs text-red-600 mb-3">
                                            {t('duplicate_biometric_desc', 'This fingerprint matches an existing voter registration.')}
                                        </p>
                                        {duplicateInfo.original_location && (
                                            <div className="bg-white/70 p-3 rounded-md text-[11px] text-red-800 border border-red-200">
                                                <p className="font-bold mb-1.5 border-b border-red-200 pb-1 uppercase tracking-wider text-[10px]">Original Registration Details</p>
                                                <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                                                    <div><span className="text-red-500 block text-[9px] uppercase tracking-wider">State</span> <span className="font-medium">{duplicateInfo.original_location.state}</span></div>
                                                    <div><span className="text-red-500 block text-[9px] uppercase tracking-wider">District</span> <span className="font-medium">{duplicateInfo.original_location.district}</span></div>
                                                    <div><span className="text-red-500 block text-[9px] uppercase tracking-wider">Tehsil</span> <span className="font-medium">{duplicateInfo.original_location.tehsil}</span></div>
                                                    <div><span className="text-red-500 block text-[9px] uppercase tracking-wider">Booth ID</span> <span className="font-mono font-bold">{duplicateInfo.original_location.booth_id}</span></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <button onClick={() => setPhase('preview')} className="mt-8 flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-slate-800 font-semibold transition-colors mx-auto px-4 py-2 rounded-full hover:bg-slate-200/50">
                        <ArrowLeft className="w-4 h-4" /> Return to Voter ID Input
                    </button>
                </main>
            </div>
        );
    }

    // =================================================================
    // PHASE: DONE
    // =================================================================
    return (
        <div className="min-h-screen bg-[#f4f6fa] flex flex-col items-stretch">
            <Toaster position="top-center" />
            <VerificationHeader operatorName={operatorName} boothId={boothId} t={t} user={user} hardwareStatus={hardwareStatus} />

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
