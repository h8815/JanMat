import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/common/TopBar';
import Footer from '../components/Footer';

const PolicyPage = () => {
    const { t } = useTranslation();
    const location = useLocation();

    // Map route path to i18n key prefix
    const path = location.pathname.replace('/', '');
    const pageType = path === 'privacy' ? 'privacy' : 
                     path === 'terms' ? 'terms' : 
                     path === 'copyright' ? 'copyright' : 
                     path === 'disclaimer' ? 'disclaimer' : 'terms';

    return (
        <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
            <TopBar variant="page" />

            {/* Breadcrumbs */}
            <div className="w-full bg-gray-50 border-b border-gray-200 py-2.5">
                <div className="max-w-[1200px] mx-auto px-4 text-sm text-gray-500">
                    <Link to="/" className="hover:text-blue-600 hover:underline">{t('about_breadcrumb_home')}</Link> 
                    <span className="mx-2">&gt;</span> 
                    <span className="text-gray-700 font-medium">{t(`policy_${pageType}_title`)}</span>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 w-full max-w-[900px] mx-auto px-4 py-16 flex flex-col gap-8">
                
                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-[2.5rem] font-bold text-slate-900 pb-3 relative after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-24 after:h-1.5 after:bg-[#de2b2b]">
                        {t(`policy_${pageType}_title`)}
                    </h1>
                </div>

                {/* Main Content Card */}
                <div className="bg-white border border-gray-100 shadow-xl shadow-gray-100/50 rounded-2xl p-8 md:p-12 leading-relaxed text-slate-700 text-lg">
                    <div 
                        className="policy-content space-y-6"
                        dangerouslySetInnerHTML={{ __html: t(`policy_${pageType}_content`) }} 
                    />
                </div>

                {/* Last Updated Status */}
                <div className="text-sm text-gray-500 italic mt-4">
                    Last Updated: April 2026 | Election Commission of India Internal Portal
                </div>

            </main>

            <Footer />
        </div>
    );
};

export default PolicyPage;
