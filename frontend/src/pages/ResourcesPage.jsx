import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/common/TopBar';
import Footer from '../components/Footer';

const ResourcesPage = () => {
    const { t } = useTranslation();

    const sections = [
        {
            title: t('landing_booth_operators'),
            items: [
                { name: t('landing_download_sops'), type: 'PDF', size: '2.4 MB' },
                { name: t('landing_hardware_list'), type: 'PDF', size: '1.1 MB' },
                { name: t('landing_faq_auth'), type: 'DOC', size: '450 KB' }
            ]
        },
        {
            title: t('landing_sys_admins'),
            items: [
                { name: t('landing_provisioning'), type: 'PDF', size: '3.8 MB' },
                { name: t('landing_time_window'), type: 'DOCX', size: '220 KB' },
                { name: t('landing_audit_logs'), type: 'PDF', size: '5.6 MB' }
            ]
        },
        {
            title: t('landing_public_media'),
            items: [
                { name: t('landing_protocol_overview'), type: 'PDF', size: '1.5 MB' },
                { name: t('landing_whitepaper'), type: 'PDF', size: '12.2 MB' },
                { name: t('landing_manifesto'), type: 'DOC', size: '890 KB' }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-white text-slate-800 font-sans flex flex-col">
            <TopBar variant="page" />

            {/* Breadcrumbs */}
            <div className="w-full bg-gray-50 border-b border-gray-200 py-2.5">
                <div className="max-w-[1200px] mx-auto px-4 text-sm text-gray-500">
                    <Link to="/" className="hover:text-blue-600 hover:underline">{t('about_breadcrumb_home')}</Link> 
                    <span className="mx-2">&gt;</span> 
                    <span className="text-gray-700 font-medium">{t('landing_important_links')}</span>
                </div>
            </div>

            {/* Content Area */}
            <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 py-16">
                
                <div className="mb-12">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">{t('landing_important_links')}</h1>
                    <p className="text-xl text-slate-600 max-w-2xl leading-relaxed">
                        Access official documentation, standard operating procedures, and technical whitepapers for the JanMat system.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {sections.map((section, idx) => (
                        <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="bg-slate-50 border-b border-gray-200 px-6 py-4">
                                <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wider">{section.title}</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                {section.items.map((item, itemIdx) => (
                                    <div key={itemIdx} className="group flex items-start gap-4 p-3 hover:bg-red-50/50 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-red-100">
                                        <div className="mt-1 w-10 h-10 flex-shrink-0 bg-gray-100 group-hover:bg-red-100 rounded flex items-center justify-center text-xs font-bold text-gray-500 group-hover:text-red-600 transition-colors">
                                            {item.type}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-base font-semibold text-slate-700 group-hover:text-red-700 transition-colors leading-snug">
                                                {item.name}
                                            </h3>
                                            <span className="text-xs text-gray-500 font-medium">{item.size}</span>
                                        </div>
                                        <svg className="w-5 h-5 text-gray-300 group-hover:text-red-400 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Key Directives Section */}
                <div className="mt-12 bg-[#0a192f] rounded-2xl p-8 md:p-12 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                    <div className="relative z-10">
                        <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                            <span className="w-8 h-1 bg-red-500"></span>
                            {t('landing_key_directives')}
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[1, 2, 3, 4].map((num) => (
                                <div key={num} className="bg-white/5 border border-white/10 p-5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer group">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Directive #{num}</span>
                                        <span className="text-[10px] text-white/40">ECI-REF-2024-00{num}</span>
                                    </div>
                                    <p className="text-white/80 font-medium group-hover:text-white transition-colors">
                                        {t(`landing_directive_${num}_label`) || `Official Mandate Regarding Digital Authentication Protocols v${num}.0`}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

            </main>

            <Footer />
        </div>
    );
};

export default ResourcesPage;
