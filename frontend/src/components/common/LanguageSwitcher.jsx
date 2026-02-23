import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, ChevronDown, Check } from 'lucide-react';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const languages = [
        { code: 'en', label: 'English', short: 'EN' },
        { code: 'hi', label: 'हिन्दी', short: 'HI' }
    ];

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    const changeLanguage = (code) => {
        i18n.changeLanguage(code);
        localStorage.setItem('janmat_language', code);
        setIsOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border transition-all duration-200 outline-none
                    ${isOpen
                        ? 'border-janmat-blue/50 bg-blue-50/50 text-janmat-blue shadow-[0_0_0_4px_rgba(11,61,145,0.05)] dark:bg-janmat-blue/10 dark:border-janmat-blue/30 dark:text-janmat-light'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700/50'
                    }`}
                title={i18n.language === 'en' ? 'Select Language' : 'भाषा चुनें'}
            >
                <Languages className={`w-4 h-4 transition-colors ${isOpen ? 'text-janmat-blue dark:text-janmat-light' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{currentLang.short}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-janmat-blue dark:text-janmat-light' : 'text-slate-400'}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200 dark:bg-slate-800 dark:border-slate-700 dark:shadow-slate-900/50">
                    <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1 dark:border-slate-700 dark:text-slate-500">
                        Select Language
                    </div>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50 group"
                        >
                            <span className={`font-medium ${i18n.language === lang.code ? 'text-janmat-blue dark:text-janmat-light' : 'text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                                {lang.label}
                            </span>
                            {i18n.language === lang.code && (
                                <Check className="w-4 h-4 text-janmat-blue dark:text-janmat-light" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LanguageSwitcher;
