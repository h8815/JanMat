import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Footer = () => {
    const { t } = useTranslation();

    return (
        <footer className="bg-slate-900 text-slate-400 py-12 border-t-[6px] border-[#de2b2b] text-sm">
            <div className="max-w-[1400px] mx-auto px-4">
                <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-8">
                    <div className="max-w-md">
                        <h2 className="text-white text-lg font-bold mb-4 flex items-center gap-3">
                            <img src="/assets/images/janmat.webp" alt="JanMat" className="h-8 drop-shadow-md brightness-200" />
                        </h2>
                        <p className="mb-4 mt-2 text-slate-400 font-medium">{t('footer_desc')}</p>
                        <p className="text-xs text-slate-500 font-mono">{t('footer_version')}</p>
                    </div>
                    <div>
                        <h3 className="text-white font-bold mb-4 uppercase tracking-wide">{t('footer_support_title')}</h3>
                        <ul className="space-y-2 text-slate-300">
                            <li><strong>Helpline:</strong> 1800-111-1950 (Toll Free)</li>
                            <li><strong>Email:</strong> e-verification@eci.gov.in</li>
                            <li><strong>Tech Desk:</strong> tech-support-janmat@nic.in</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-white font-bold mb-4 uppercase tracking-wide">{t('footer_important_links')}</h3>
                        <ul className="space-y-2">
                            <li><Link to="/about" className="hover:text-white hover:underline transition">{t('landing_about_initiative')}</Link></li>
                            <li><Link to="/terms" className="hover:text-white hover:underline transition">{t('landing_terms')}</Link></li>
                            <li><Link to="/privacy" className="hover:text-white hover:underline transition">{t('landing_privacy')}</Link></li>
                            <li><Link to="/copyright" className="hover:text-white hover:underline transition">{t('landing_copyright')}</Link></li>
                            <li><Link to="/disclaimer" className="hover:text-white hover:underline transition">{t('landing_disclaimer')}</Link></li>
                        </ul>
                    </div>
                </div>
                <div className="border-t border-slate-700 pt-8 flex flex-col text-center gap-2 text-xs text-slate-500">
                     <p>{t('footer_nic')}</p>
                     <p>{t('footer_ministry')}</p>
                     <p className="mt-2 text-[10px]">Last Updated: Oct 15, {new Date().getFullYear()}</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

