import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Languages, ChevronDown } from 'lucide-react';
import { useFontSize } from '../../context/FontSizeContext';

const TopBar = ({ variant = 'landing' }) => {
    const { fontSize, decrease, reset, increase } = useFontSize();
    const { t, i18n } = useTranslation();

    const currentLang = i18n.language;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const toggleLanguage = () => {
        const newLang = currentLang === 'en' ? 'hi' : 'en';
        i18n.changeLanguage(newLang);
        localStorage.setItem('janmat_language', newLang);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isLanding = variant === 'landing';

    const containerClass = isLanding
        ? 'relative z-50 w-full text-base text-white pt-5 pb-2 font-sans tracking-wide'
        : 'w-full bg-[#151515] text-white py-3 border-b border-gray-800 shadow-[0_4px_12px_rgba(0,0,0,0.15)] relative z-50';

    return (
        <header className={containerClass}>
            <div className={`max-w-[1400px] mx-auto px-4 lg:px-8 flex ${isLanding ? 'justify-end' : 'justify-between'} items-center gap-6`}>

                {/* Logo — visible only on non-landing pages */}
                {!isLanding && (
                    <Link to="/" className="flex-shrink-0">
                        <img
                            src="/assets/images/janmat.png"
                            alt="JanMat Portal"
                            className="h-16 md:h-20 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
                        />
                    </Link>
                )}

                {/* Right Side Utilities */}
                <div className="flex items-center gap-6 text-sm md:text-base font-semibold tracking-wide text-slate-200">
                    {/* About Link */}
                    <div className="flex items-center gap-2 pr-2 border-r border-white/20">
                        <Link to="/about" className="hover:text-white cursor-pointer transition">{t('topbar_about')}</Link>
                    </div>

                    {/* Font Size Controls */}
                    <div className="flex items-center gap-2 pr-2 border-r border-white/20">
                        <button
                            onClick={decrease}
                            className={`hover:text-white transition ${fontSize === 'small' ? 'text-white underline underline-offset-4' : ''}`}
                            title={t('topbar_decrease_font')}
                        >
                            A-
                        </button>
                        <button
                            onClick={reset}
                            className={`hover:text-white transition ${fontSize === 'normal' ? 'text-white underline underline-offset-4' : ''}`}
                            title={t('topbar_normal_font')}
                        >
                            A
                        </button>
                        <button
                            onClick={increase}
                            className={`hover:text-white transition ${fontSize === 'large' ? 'text-white underline underline-offset-4' : ''}`}
                            title={t('topbar_increase_font')}
                        >
                            A+
                        </button>
                    </div>

                    {/* Language Toggle */}
                    <div className="flex items-center gap-1 pr-4 border-r border-white/20">
                        <button
                            onClick={toggleLanguage}
                            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                            title={t('topbar_switch_language')}
                        >
                            <Languages className="w-5 h-5 text-white" />
                            <div className="flex items-center text-xs font-bold bg-white/10 rounded-full px-2 py-0.5">
                                <span className={currentLang === 'en' ? 'text-white' : 'text-slate-400'}>En</span>
                                <span className="mx-1 text-white/50">|</span>
                                <span className={currentLang === 'hi' ? 'text-white' : 'text-slate-400'}>हि</span>
                            </div>
                        </button>
                    </div>

                    {/* Auth Button Dropdown */}
                    <div className="relative" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="flex items-center gap-2 bg-[#c22311] text-white font-bold px-5 py-2 rounded-lg shadow-md hover:bg-red-700 transition-colors uppercase text-sm tracking-wider"
                        >
                            <span>{t('topbar_sign_in')}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {/* Dropdown Menu */}
                        {isDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-56 bg-white text-slate-800 rounded-xl shadow-2xl z-50 border border-slate-100 overflow-hidden">
                                <Link 
                                    to="/login?role=admin" 
                                    onClick={() => setIsDropdownOpen(false)}
                                    className="block px-5 py-3.5 text-left font-bold border-b border-slate-100 active:bg-slate-100"
                                >
                                    {t('topbar_admin_login')}
                                </Link>
                                <Link 
                                    to="/login?role=operator" 
                                    onClick={() => setIsDropdownOpen(false)}
                                    className="block px-5 py-3.5 text-left font-bold active:bg-slate-100"
                                >
                                    {t('topbar_operator_login')}
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default TopBar;
