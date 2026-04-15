import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Footer from '../components/Footer';
import TopBar from '../components/common/TopBar';

const About = () => {
    const { t } = useTranslation();
    return (
        <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
            <TopBar variant="page" />

            {/* Breadcrumbs */}
            <div className="w-full bg-gray-50 border-b border-gray-200 py-2.5">
                 <div className="max-w-[1200px] mx-auto px-4 text-sm text-gray-500">
                      <Link to="/" className="hover:text-blue-600 hover:underline">{t('about_breadcrumb_home')}</Link> <span className="mx-2">&gt;</span> <span className="text-gray-700 font-medium">{t('about_breadcrumb')}</span>
                 </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 w-full max-w-[1000px] mx-auto px-4 py-12 flex flex-col gap-8">
                
                {/* Title */}
                <div className="text-center mb-2">
                    <h1 className="inline-block text-[2.5rem] font-bold text-slate-900 pb-3 relative after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-full after:h-1 after:bg-[#de2b2b]">
                        {t('about_title')}
                    </h1>
                </div>

                <p className="text-base text-slate-700 leading-relaxed font-medium" dangerouslySetInnerHTML={{ __html: t('about_intro') }} />

                {/* Core Functionality Section */}
                <div>
                     <h2 className="text-[1.35rem] font-bold text-slate-900 mb-3 tracking-tight">{t('about_core_title')}</h2>
                     <p className="text-base text-slate-700 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: t('about_core_desc') }} />
                     <ul className="list-disc list-inside text-base text-slate-700 leading-relaxed ml-2 space-y-2">
                         <li dangerouslySetInnerHTML={{ __html: t('about_step1') }} />
                         <li dangerouslySetInnerHTML={{ __html: t('about_step2') }} />
                         <li dangerouslySetInnerHTML={{ __html: t('about_step3') }} />
                     </ul>
                </div>

                {/* Combating Electoral Fraud */}
                <div>
                     <h2 className="text-[1.35rem] font-bold text-slate-900 mb-3 tracking-tight">{t('about_fraud_title')}</h2>
                     <p className="text-base text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('about_fraud_desc') }} />
                </div>

                {/* Roles (System Admins & Operators) */}
                <div>
                     <h2 className="text-[1.35rem] font-bold text-slate-900 mb-3 tracking-tight">{t('about_roles_title')}</h2>
                     <p className="text-base text-slate-700 leading-relaxed mb-4" dangerouslySetInnerHTML={{ __html: t('about_admin_role') }} />
                     <p className="text-base text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: t('about_operator_role') }} />
                </div>

                {/* Data Sources */}
                <div>
                     <h2 className="text-[1.35rem] font-bold text-slate-900 mb-3 tracking-tight">{t('about_data_title')}</h2>
                     <p className="text-base text-slate-700 leading-relaxed bg-[#f8f9fa] p-4 rounded border border-gray-200 shadow-sm font-medium">
                         {t('about_data_desc')}
                     </p>
                </div>

                {/* Our Vision */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-100 italic">
                     <h2 className="text-[1.35rem] font-bold text-slate-900 mb-3 tracking-tight not-italic">{t('about_vision_title')}</h2>
                     <p className="text-lg text-slate-800 leading-relaxed font-serif">
                         "{t('about_vision_desc')}"
                     </p>
                </div>

            </main>

            {/* UNIVERSAL FOOTER */}
            <Footer />
        </div>
    );
};

export default About;
