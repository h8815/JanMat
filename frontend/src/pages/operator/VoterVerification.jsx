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
import FontSizeSwitcher from '../../components/common/FontSizeSwitcher';
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
    const [scanState, setScanState] = useState('idle'); // idle | scanning | success | duplicate | failed | timeout | poor_quality
    const [scanQuality, setScanQuality] = useState(null);
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
        setScanQuality(null);
        setScanError('');

        let isTimedOut = false;
        // 8-second hard timeout
        scanTimeoutRef.current = setTimeout(() => {
            isTimedOut = true;
            setScanState('timeout');
            setScanQuality(null);
            setRetryCount(prev => prev + 1);
            setLoading(false);
        }, 8000);

        // Live quality fluctuations
        let poorCount = 0;
        const qualityInterval = setInterval(() => {
            if (isTimedOut) { clearInterval(qualityInterval); return; }
            const q = Math.random();
            const quality = q < 0.25 ? 'Poor' : q < 0.65 ? 'Good' : 'Excellent';
            setScanQuality(quality);
            if (quality === 'Poor') poorCount++;
        }, 500);

        // Random 5-9s scan. If > 8s, timeout fires first.
        const scanDuration = Math.floor(Math.random() * 4000) + 5000;
        await new Promise(r => setTimeout(r, scanDuration));

        if (isTimedOut) return;

        clearInterval(qualityInterval);
        clearTimeout(scanTimeoutRef.current);

        // Abort early if quality was consistently poor (> 6 poor readings)
        if (poorCount >= 6) {
            setScanState('poor_quality');
            setScanQuality('Poor');
            setRetryCount(prev => prev + 1);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const finalQualityScore = Math.floor(Math.random() * 15) + 85;
            setScanQuality(finalQualityScore > 92 ? 'Excellent' : 'Good');
            const biometricData = `fp_${aadhaar.replace(/\s/g, '')}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const res = await axios.post('/verification/biometric-scan/', {
                biometric_data: biometricData,
                quality_score: finalQualityScore
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
        setScanQuality(null);
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
        setScanQuality(null);
        setScanError('');
        setRetryCount(0);
        setDuplicateInfo(null);
        setFraudAlert(null);
        clearTimeout(scanTimeoutRef.current);
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
                        <div className="hidden md:flex flex-col items-end mr-4">
                            <span className="text-[10px] text-slate-400 font-medium">Last Login</span>
                            <span className="text-xs text-slate-600 font-semibold">{user?.last_login ? new Date(user.last_login).toLocaleString() : 'Just now'}</span>
                        </div>
                        <FontSizeSwitcher />
                        <div className="h-4 w-px bg-slate-200" />
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
                            <p className="text-[11px] text-slate-400 mb-5">{t('aadhaar_note')}</p>

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
            <div className="min-h-screen bg-[#f4f6fa]">
                <Toaster position="top-center" />
                <Header />

                <main className="max-w-5xl mx-auto p-4 sm:p-6 mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LEFT: Biometric Scanner — Rugged Hardware Terminal */}
                        <div className="bg-[#1e293b] rounded-2xl border-t-2 border-slate-600 border-x-2 border-b-8 border-slate-900 p-5 sm:p-6 shadow-2xl flex flex-col relative">
                            {/* Hardware Screws */}
                            <div className="absolute top-4 left-4 w-2.5 h-2.5 rounded-full bg-slate-950 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] border border-slate-700"></div>
                            <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-slate-950 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] border border-slate-700"></div>
                            <div className="absolute bottom-4 left-4 w-2.5 h-2.5 rounded-full bg-slate-950 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] border border-slate-700"></div>
                            <div className="absolute bottom-4 right-4 w-2.5 h-2.5 rounded-full bg-slate-950 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] border border-slate-700"></div>

                            <div className="flex flex-col h-full z-10 px-1 sm:px-2 py-1">
                                {/* Header Row */}
                                <div className="flex items-center justify-between mb-6">
                                    <div className="pl-2">
                                        <h2 className="text-lg font-bold text-slate-100 tracking-tight uppercase">{t('step_3_title', 'Biometric Scan')}</h2>
                                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono tracking-widest">ECI-BIOMETRIC-TERMINAL v2.1</p>
                                    </div>
                                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded border-2 text-[10px] font-bold uppercase tracking-widest bg-slate-900 shadow-inner ${hardwareStatus === 'Ready' ? 'border-green-500/50 text-green-400' :
                                        hardwareStatus === 'Connected' ? 'border-amber-500/50 text-amber-400' :
                                            'border-slate-700 text-slate-500'
                                        }`}>
                                        <span className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${hardwareStatus === 'Ready' ? 'bg-green-500 animate-pulse' :
                                            hardwareStatus === 'Connected' ? 'bg-amber-400 animate-pulse' :
                                                'bg-slate-600'
                                            }`} />
                                        {hardwareStatus}
                                    </div>
                                </div>

                                {/* Physical Scanner Window */}
                                <div className="relative flex-1 min-h-[280px] flex flex-col items-center justify-center rounded-xl bg-[#090e17] border-b-4 border-slate-800 shadow-[inset_0_15px_30px_rgba(0,0,0,0.9)] overflow-hidden">
                                    {/* Green scanning laser line */}
                                    {scanState === 'scanning' && <div className="absolute top-0 left-0 w-full h-1 z-20 bg-green-400 shadow-[0_0_15px_5px_rgba(74,222,128,0.5)] animate-[scan_2s_linear_infinite]" />}

                                    {/* Glass reflection */}
                                    <div className="absolute inset-0 z-10 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-xl"></div>

                                    {/* Corner brackets */}
                                    <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-slate-700/50" />
                                    <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-slate-700/50" />
                                    <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-slate-700/50" />
                                    <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-slate-700/50" />

                                    {/* IDLE */}
                                    {scanState === 'idle' && (
                                        <div className="flex flex-col items-center gap-4 z-10">
                                            <div className="w-28 h-28 rounded-full border border-slate-700 flex items-center justify-center">
                                                <div className="w-20 h-20 rounded-full border border-slate-700/60 flex items-center justify-center">
                                                    <svg className="w-10 h-10 text-slate-600" fill="none" viewBox="0 0 100 100" stroke="currentColor" strokeWidth="3">
                                                        <path strokeLinecap="round" d="M50 10 C28 10, 10 28, 10 50" />
                                                        <path strokeLinecap="round" d="M50 10 C72 10, 90 28, 90 50" />
                                                        <path strokeLinecap="round" d="M30 50 C30 39, 39 30, 50 30 C61 30, 70 39, 70 50 C70 65, 60 75, 50 78" />
                                                        <path strokeLinecap="round" d="M20 55 C18 35, 33 18, 50 18 C67 18, 82 33, 82 50 C82 70, 67 85, 50 88" />
                                                        <path strokeLinecap="round" d="M40 50 C40 44, 44 40, 50 40 C56 40, 60 44, 60 50 C60 60, 53 66, 50 68" />
                                                    </svg>
                                                </div>
                                            </div>
                                            <p className="text-slate-400 font-semibold text-sm">{t('scan_waiting', 'Place finger on scanner')}</p>
                                            <p className="text-slate-600 text-xs font-mono">Awaiting biometric input</p>
                                        </div>
                                    )}

                                    {/* SCANNING */}
                                    {scanState === 'scanning' && (
                                        <div className="flex flex-col items-center gap-4 z-10">
                                            <div className="relative flex items-center justify-center">
                                                <div className="absolute w-40 h-40 rounded-full border border-indigo-500/15 animate-ping" style={{ animationDuration: '1.8s' }} />
                                                <div className="absolute w-32 h-32 rounded-full border border-indigo-500/25 animate-ping" style={{ animationDuration: '1.8s', animationDelay: '0.4s' }} />
                                                <div className="w-28 h-28 rounded-full border-2 border-indigo-500/70 bg-indigo-500/5 flex items-center justify-center">
                                                    <div className="relative w-14 h-16 overflow-hidden">
                                                        <svg className="w-12 h-12 text-indigo-400" fill="none" viewBox="0 0 100 100" stroke="currentColor" strokeWidth="3">
                                                            <path strokeLinecap="round" d="M50 10 C28 10, 10 28, 10 50" />
                                                            <path strokeLinecap="round" d="M50 10 C72 10, 90 28, 90 50" />
                                                            <path strokeLinecap="round" d="M30 50 C30 39, 39 30, 50 30 C61 30, 70 39, 70 50 C70 65, 60 75, 50 78" />
                                                            <path strokeLinecap="round" d="M20 55 C18 35, 33 18, 50 18 C67 18, 82 33, 82 50 C82 70, 67 85, 50 88" />
                                                            <path strokeLinecap="round" d="M40 50 C40 44, 44 40, 50 40 C56 40, 60 44, 60 50 C60 60, 53 66, 50 68" />
                                                        </svg>
                                                        <div className="absolute inset-x-0 h-0.5 bg-indigo-400 shadow-[0_0_10px_4px_rgba(129,140,248,0.7)] animate-[scan_1.5s_ease-in-out_infinite]" />
                                                    </div>
                                                </div>
                                            </div>
                                            <p className="text-indigo-400 font-black text-sm tracking-[0.25em] uppercase animate-pulse">{t('scan_scanning', 'Scanning...')}</p>
                                            {scanQuality && (
                                                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest ${scanQuality === 'Excellent' ? 'border-green-500/40 text-green-400 bg-green-500/10' : scanQuality === 'Good' ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10' : 'border-red-500/40 text-red-400 bg-red-500/10'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${scanQuality === 'Excellent' ? 'bg-green-400' : scanQuality === 'Good' ? 'bg-indigo-400' : 'bg-red-400'}`} />
                                                    Signal: {scanQuality}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* SUCCESS */}
                                    {scanState === 'success' && (
                                        <div className="flex flex-col items-center gap-4 z-10">
                                            <div className="relative flex items-center justify-center">
                                                <div className="absolute w-32 h-32 rounded-full border border-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                                                <div className="w-28 h-28 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center">
                                                    <CheckCircle2 className="w-14 h-14 text-green-400" />
                                                </div>
                                            </div>
                                            <p className="text-green-400 font-black text-sm tracking-[0.2em] uppercase">{t('scan_success', 'Identity Confirmed')}</p>
                                            <p className="text-slate-500 text-xs font-mono">Biometric match successful</p>
                                        </div>
                                    )}

                                    {/* DUPLICATE */}
                                    {scanState === 'duplicate' && (
                                        <div className="flex flex-col items-center gap-4 z-10">
                                            <div className="w-28 h-28 rounded-full bg-red-500/10 border-2 border-red-500 flex items-center justify-center">
                                                <AlertTriangle className="w-14 h-14 text-red-400" />
                                            </div>
                                            <p className="text-red-400 font-black text-sm tracking-[0.2em] uppercase">{t('scan_duplicate_detected', 'Duplicate Detected')}</p>
                                            <p className="text-slate-500 text-xs font-mono">Voter biometric already registered</p>
                                        </div>
                                    )}

                                    {/* FAILED */}
                                    {scanState === 'failed' && (
                                        <div className="flex flex-col items-center gap-3 z-10 px-4 text-center">
                                            <div className="w-24 h-24 rounded-full bg-orange-500/10 border-2 border-orange-500 flex items-center justify-center">
                                                <AlertTriangle className="w-12 h-12 text-orange-400" />
                                            </div>
                                            <p className="text-orange-400 font-black text-sm tracking-widest uppercase">Scan Failed</p>
                                            <p className="text-slate-400 text-[11px] font-mono leading-relaxed">{scanError || 'The scan could not be completed. Please try again.'}</p>
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                                                <span className="text-[9px] text-orange-400 font-mono uppercase tracking-widest">Attempts: {retryCount}/3</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* TIMEOUT */}
                                    {scanState === 'timeout' && (
                                        <div className="flex flex-col items-center gap-3 z-10 px-4 text-center">
                                            <div className="w-24 h-24 rounded-full bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center">
                                                <svg className="w-12 h-12 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </div>
                                            <p className="text-amber-400 font-black text-sm tracking-widest uppercase">Unable to Detect</p>
                                            <p className="text-slate-400 text-[11px] font-mono">No finger detected within 8 seconds. Please retry.</p>
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                                                <span className="text-[9px] text-amber-400 font-mono uppercase tracking-widest">Attempts: {retryCount}/3</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* POOR QUALITY */}
                                    {scanState === 'poor_quality' && (
                                        <div className="flex flex-col items-center gap-3 z-10 px-4 text-center">
                                            <div className="w-24 h-24 rounded-full bg-yellow-500/10 border-2 border-yellow-500 flex items-center justify-center">
                                                <svg className="w-12 h-12 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                                                </svg>
                                            </div>
                                            <p className="text-yellow-400 font-black text-sm tracking-widest uppercase">Poor Signal</p>
                                            <p className="text-slate-400 text-[11px] font-mono leading-relaxed">Fingerprint quality too low to process.<br />Clean finger &amp; press firmly on sensor.</p>
                                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                                                <span className="text-[9px] text-yellow-400 font-mono uppercase tracking-widest">Attempts: {retryCount}/3</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Terminal Log Box */}
                                <div className="mt-5 bg-[#0b101a] rounded border border-slate-700/60 p-3 h-20 overflow-y-auto font-mono text-[10px] sm:text-xs leading-relaxed shadow-[inset_0_2px_5px_rgba(0,0,0,0.5)]">
                                    <p className="text-slate-500">&gt; KERNEL INIT... OK</p>
                                    {hardwareStatus === 'Connected' && <p className="text-amber-400">&gt; PROBING USB DEVICES... FOUND BIOMETRIC_SENSOR</p>}
                                    {hardwareStatus === 'Ready' && <>
                                        <p className="text-green-500">&gt; DEVICE HOOKED.</p>
                                        <p className="text-green-400 font-bold">&gt; SYSTEM READY. WAITING FOR INPUT.</p>
                                    </>}
                                    {scanState === 'scanning' && <p className="text-green-400 animate-pulse">&gt; SENSOR ACTIVE: READING MINUTIAE DATA...</p>}
                                    {scanState === 'success' && <p className="text-green-400">&gt; MINUTIAE EXTRACTED. HASH MATCH: VALID.</p>}
                                    {(scanState === 'failed' || scanState === 'timeout' || scanState === 'poor_quality') && <p className="text-red-400 font-bold">&gt; ERR: SCAN TERMINATED — {scanState.toUpperCase()}</p>}
                                </div>

                                {/* Retry Counter Dots */}
                                {['failed', 'timeout', 'poor_quality'].includes(scanState) && retryCount < 3 && (
                                    <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-[#0b101a] border border-slate-700/60 rounded">
                                        <div className="flex gap-1">
                                            {[1, 2, 3].map(n => (
                                                <div key={n} className={`w-2 h-2 rounded-full ${n <= retryCount ? 'bg-red-500 shadow-[0_0_5px_#ef4444]' : 'bg-slate-700'}`} />
                                            ))}
                                        </div>
                                        <span className="text-[10px] text-slate-400 font-mono">{3 - retryCount} attempt{3 - retryCount !== 1 ? 's' : ''} remaining</span>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="mt-5 space-y-3">
                                    {/* IDLE */}
                                    {scanState === 'idle' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={handleStartScan}
                                                disabled={hardwareStatus !== 'Ready' || retryCount >= 3}
                                                className="flex-1 py-3.5 bg-violet-600 text-white text-sm font-bold rounded-lg hover:bg-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_0_rgb(88,28,135)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(88,28,135)] active:translate-y-[4px] active:shadow-none flex items-center justify-center gap-2 uppercase tracking-widest border border-violet-400"
                                            >
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                                                {hardwareStatus === 'Ready' ? t('btn_start_scan', 'Initiate Scan') : 'Initializing Device...'}
                                            </button>
                                            <button
                                                onClick={() => setPhase('preview')}
                                                className="px-5 py-3.5 border border-slate-600 text-slate-300 text-sm font-semibold rounded-lg hover:bg-slate-700 hover:text-white transition-all shadow-[0_4px_0_rgb(71,85,105)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(71,85,105)] active:translate-y-[4px] active:shadow-none"
                                            >
                                                {t('btn_cancel_back', 'Back')}
                                            </button>
                                        </div>
                                    )}

                                    {/* SUCCESS */}
                                    {scanState === 'success' && (
                                        <button
                                            onClick={handleMarkVoted}
                                            className="w-full py-3.5 bg-green-600 text-white text-sm font-black rounded-lg hover:bg-green-500 transition-all shadow-[0_4px_0_rgb(22,101,52)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(22,101,52)] active:translate-y-[4px] active:shadow-none uppercase tracking-widest border border-green-500"
                                        >
                                            {t('btn_mark_voted', 'Mark as Voted & Continue →')}
                                        </button>
                                    )}

                                    {/* DUPLICATE */}
                                    {scanState === 'duplicate' && (
                                        <button
                                            onClick={handleReset}
                                            className="w-full py-3.5 bg-red-700 text-white text-sm font-black rounded-lg hover:bg-red-600 transition-all shadow-[0_4px_0_rgb(153,27,27)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(153,27,27)] active:translate-y-[4px] active:shadow-none uppercase tracking-widest border border-red-500"
                                        >
                                            Flag as Fraud &amp; Start Over
                                        </button>
                                    )}

                                    {/* FAILED / TIMEOUT / POOR QUALITY */}
                                    {['failed', 'timeout', 'poor_quality'].includes(scanState) && (
                                        <div className="space-y-3">
                                            {retryCount < 3 ? (
                                                <button
                                                    onClick={handleRetryScan}
                                                    className="w-full py-3.5 bg-violet-700 text-white text-sm font-bold rounded-lg hover:bg-violet-600 transition-all flex items-center justify-center gap-2 shadow-[0_4px_0_rgb(88,28,135)] hover:translate-y-[2px] hover:shadow-[0_2px_0_rgb(88,28,135)] active:translate-y-[4px] active:shadow-none border border-violet-500 uppercase tracking-widest"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                                    Retake Scan ({3 - retryCount} left)
                                                </button>
                                            ) : (
                                                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-center">
                                                    <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-1">⛔ Maximum Attempts Reached</p>
                                                    <p className="text-slate-400 text-[10px] font-mono">Escalate to supervisor or use manual override procedure.</p>
                                                </div>
                                            )}
                                            <button
                                                onClick={handleReset}
                                                className="w-full py-2.5 border border-slate-600 text-slate-400 text-xs font-semibold rounded-lg hover:bg-slate-700 hover:text-white transition-all"
                                            >
                                                Cancel &amp; Start New Verification
                                            </button>
                                        </div>
                                    )}

                                    <p className="text-center text-[9px] text-slate-500 font-mono pt-1">
                                        {t('biometric_note', 'All biometric data is encrypted end-to-end and never stored.')}
                                    </p>
                                </div>
                            </div>
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
                </main >
            </div >
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
