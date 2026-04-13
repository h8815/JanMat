import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserCheck, Fingerprint, ShieldCheck } from 'lucide-react';
import Footer from '../components/Footer';
import TopBar from '../components/common/TopBar';
import api from '../api/axios';

const Landing = () => {
    const { t } = useTranslation();
    const currentYear = new Date().getFullYear();
    const [bgIndex, setBgIndex] = useState(0);
    const [stats, setStats] = useState({ nodes: '0+', verified: '0', fraud: '0' });

    const backgrounds = [
        '/assets/images/indiaGate.png',
        '/assets/images/votebg.png'
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setBgIndex(prevIndex => (prevIndex + 1) % backgrounds.length);
        }, 6000); // Cross-fade every 6 seconds

        const fetchStats = async () => {
            try {
                // Use standard API client
                const response = await api.get('/verification/public-stats/');
                if (response.status === 200) {
                    const data = response.data;
                    setStats({
                        nodes: data.nodes > 0 ? data.nodes.toLocaleString() + '+' : '0',
                        verified: data.verified >= 1000 ? (data.verified / 1000).toFixed(1) + 'K' : data.verified.toLocaleString(),
                        fraud: data.fraud.toLocaleString()
                    });
                }
            } catch (error) {
                console.error('Failed to fetch public stats:', error);
            }
        };
        fetchStats();

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-red-200">
            {/* HERO SECTION */}
            <div className="relative flex flex-col overflow-hidden bg-black min-h-screen">
                {/* Background Slideshow */}
                <div className="absolute inset-0 z-0 bg-black">
                    {backgrounds.map((bg, idx) => (
                        <div
                            key={idx}
                            className={`absolute inset-0 bg-cover bg-top transition-opacity duration-[3000ms] ease-in-out ${bgIndex === idx ? 'opacity-100' : 'opacity-0'}`}
                            style={{ backgroundImage: `url('${bg}')` }}
                        />
                    ))}
                </div>

                {/* Selective Color Overlay for Atmosphere */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent z-10 pointer-events-none"></div>
                <div className="absolute inset-0 bg-[#9b61c2]/70 z-10 pointer-events-none mix-blend-multiply"></div>

                <TopBar variant="landing" />

                <main className="relative z-20 flex-1 flex flex-col items-center justify-center pt-8 pb-16 px-4">
                    <div className="text-center w-full max-w-6xl mx-auto flex flex-col items-center">
                        <div className="flex flex-col items-center">
                            <img
                                src="/assets/images/janmat.png"
                                alt="JanMat Portal"
                                className="w-48 sm:w-64 md:w-80 lg:w-[24rem] h-auto object-contain drop-shadow-[0_8px_32px_rgba(0,0,0,0.8)] mb-8"
                            />
                            
                            {/* Main Tagline */}
                            <div className="pt-4 flex flex-col items-center animate-fade-in">
                                <h2 className="text-white text-2xl md:text-3xl font-black tracking-widest uppercase mb-6 drop-shadow-2xl text-center max-w-4xl">
                                    {t('landing_hero_tagline')}
                                </h2>
                                <p className="text-white/80 text-base md:text-lg font-medium italic max-w-2xl text-center drop-shadow-md">
                                    {t('landing_hero_subtitle')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* NATIONAL UPDATES TICKER */}
                    <div className="absolute bottom-0 w-full z-20 bg-[#141016]/95 border-t border-white/5 h-10 flex items-center">
                        <div className="flex items-center w-full px-4 max-w-[1400px] mx-auto">
                            <div className="bg-[#e31e24] text-white h-6 px-3 rounded-md flex items-center justify-center font-bold text-[10px] uppercase tracking-wider whitespace-nowrap shadow-sm z-30 mr-6">
                                {t('landing_ticker_label')}
                            </div>
                            <div className="flex-1 text-white/90 text-[13px] font-semibold tracking-widest overflow-hidden whitespace-nowrap flex items-center">
                                <marquee behavior="scroll" direction="left" scrollamount="5" className="pr-4 italic">
                                    {t('landing_ticker_text')}
                                </marquee>
                            </div>
                        </div>
                    </div>
                </main>
            </div>


            {/* PROJECT ABSTRACT / VISION */}
            <section className="py-12 bg-white">
                <div className="max-w-[1000px] mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-50 rounded-full text-red-700 text-xs font-bold uppercase tracking-wider mb-6 border border-red-100">
                        {t('landing_vision_badge')}
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-8 tracking-tight">{t('landing_vision_title')}</h2>
                    <p className="text-lg md:text-xl text-slate-600 leading-relaxed font-medium italic">
                        {t('landing_vision_desc')}
                    </p>
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                                {t('landing_objective_title')}
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                {t('landing_objective_desc')}
                            </p>
                        </div>
                        <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                            <h3 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                                {t('landing_data_title')}
                            </h3>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Leveraging blockchain-based hashing to make each verification transaction immutable 
                                and verifiable across the national electoral network.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            <section className="py-12 md:py-16 bg-[#f8f9fa] relative border-y border-slate-200">
                <div className="max-w-[1300px] mx-auto px-4">
                    <div className="flex flex-col items-center mb-10 text-center">
                        <span className="text-red-600 font-bold tracking-[0.2em] text-xs uppercase mb-3 bg-red-50 px-3 py-1 rounded-full border border-red-100 shadow-sm">{t('sec_badge')}</span>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 tracking-tight">{t('sec_title')}</h2>
                        <p className="text-slate-500 max-w-3xl text-lg md:text-xl font-medium leading-relaxed">{t('sec_desc')}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                        {/* Card 1 */}
                        <div className="bg-white p-10 rounded-2xl shadow-xl shadow-slate-200/40 border-t-[6px] border-t-red-500 border-x border-b border-slate-100 hover:-translate-y-2 transition duration-500 relative group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                            <div className="relative z-10 flex items-center justify-center w-20 h-20 bg-red-50 text-red-600 rounded-2xl mb-8 border border-red-100 shadow-sm">
                                <UserCheck className="w-10 h-10" strokeWidth={2} />
                            </div>
                            <h3 className="text-2xl font-black mb-4 text-slate-900">{t('sec_card1_title')}</h3>
                            <p className="text-slate-600 leading-relaxed text-sm mb-6">{t('sec_card1_desc')}</p>
                            <ul className="space-y-3 relative z-10">
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span> {t('sec_card1_b1')}</li>
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span> {t('sec_card1_b2')}</li>
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2"></span> {t('sec_card1_b3')}</li>
                            </ul>
                        </div>
                        
                        {/* Card 2 */}
                        <div className="bg-white p-10 rounded-2xl shadow-2xl shadow-orange-900/5 border-t-[6px] border-t-orange-500 border-x border-b border-slate-100 hover:-translate-y-2 transition duration-500 relative group overflow-hidden transform md:-translate-y-4">
                            <div className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] uppercase font-black tracking-widest px-4 py-1.5 rounded-bl-lg shadow-md z-20">{t('sec_core_layer')}</div>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                            
                            <div className="relative z-10 flex items-center justify-center w-20 h-20 bg-orange-50 text-orange-500 rounded-2xl mb-8 border border-orange-100 shadow-sm">
                                <Fingerprint className="w-10 h-10" strokeWidth={2} />
                            </div>
                            <h3 className="text-2xl font-black mb-4 text-slate-900">{t('sec_card2_title')}</h3>
                            <p className="text-slate-600 leading-relaxed text-sm mb-6">{t('sec_card2_desc')}</p>
                            <ul className="space-y-3 relative z-10">
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></span> {t('sec_card2_b1')}</li>
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></span> {t('sec_card2_b2')}</li>
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"></span> {t('sec_card2_b3')}</li>
                            </ul>
                        </div>
                        
                        {/* Card 3 */}
                        <div className="bg-white p-10 rounded-2xl shadow-xl shadow-slate-200/40 border-t-[6px] border-t-slate-700 border-x border-b border-slate-100 hover:-translate-y-2 transition duration-500 relative group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -mr-10 -mt-10 opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                            <div className="relative z-10 flex items-center justify-center w-20 h-20 bg-slate-50 text-slate-700 rounded-2xl mb-8 border border-slate-200 shadow-sm">
                                <ShieldCheck className="w-10 h-10" strokeWidth={2} />
                            </div>
                            <h3 className="text-2xl font-black mb-4 text-slate-900">{t('sec_card3_title')}</h3>
                            <p className="text-slate-600 leading-relaxed text-sm mb-6">{t('sec_card3_desc')}</p>
                            <ul className="space-y-3 relative z-10">
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-slate-700 rounded-full mr-2"></span> {t('sec_card3_b1')}</li>
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-slate-700 rounded-full mr-2"></span> {t('sec_card3_b2')}</li>
                                <li className="flex items-center text-xs font-bold text-slate-700"><span className="w-1.5 h-1.5 bg-slate-700 rounded-full mr-2"></span> {t('sec_card3_b3')}</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* NOTIFICATIONS & CIRCULARS (Gov Website Feel) */}
            <section className="py-20 bg-white">
                <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row gap-12">
                     <div className="w-full md:w-2/3">
                         <div className="flex justify-between items-end border-b-2 border-red-600 pb-3 mb-8">
                             <h2 className="text-3xl font-black text-slate-900">{t('circ_title')}</h2>
                             <a href="#" className="hidden sm:block text-sm font-bold text-red-600 hover:text-red-800">{t('circ_view_all')}</a>
                         </div>
                         <div className="space-y-6">
                             {/* Item 1 */}
                             <div className="flex gap-6 group cursor-pointer hover:bg-slate-50 p-4 -mx-4 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                 <div className="flex flex-col items-center justify-center bg-white min-w-[80px] h-[80px] rounded shadow border-l-4 border-red-600 group-hover:border-red-500">
                                     <span className="text-2xl font-black text-slate-800 leading-none">12</span>
                                     <span className="text-xs font-bold text-slate-500 uppercase mt-1">Oct 2026</span>
                                 </div>
                                 <div className="flex-1">
                                     <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-800 rounded uppercase tracking-wider mb-2">{t('circ1_tag')}</span>
                                     <h4 className="text-lg font-bold text-slate-900 group-hover:text-red-600 transition-colors">{t('circ1_title')}</h4>
                                     <p className="text-sm text-slate-600 mt-1">{t('circ1_desc')}</p>
                                 </div>
                             </div>
                             {/* Item 2 */}
                             <Link to="/resources" className="flex gap-6 group cursor-pointer hover:bg-slate-50 p-4 -mx-4 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                 <div className="flex flex-col items-center justify-center bg-white min-w-[80px] h-[80px] rounded shadow border-l-4 border-orange-600 group-hover:border-orange-500">
                                     <span className="text-2xl font-black text-slate-800 leading-none">08</span>
                                     <span className="text-xs font-bold text-slate-500 uppercase mt-1">Oct 2026</span>
                                 </div>
                                 <div className="flex-1">
                                     <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 rounded uppercase tracking-wider mb-2">{t('circ2_tag')}</span>
                                     <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t('circ2_title')}</h4>
                                     <p className="text-sm text-slate-600 mt-1">{t('circ2_desc')}</p>
                                 </div>
                             </Link>
                             {/* Item 3 */}
                             <Link to="/resources" className="flex gap-6 group cursor-pointer hover:bg-slate-50 p-4 -mx-4 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                 <div className="flex flex-col items-center justify-center bg-white min-w-[80px] h-[80px] rounded shadow border-l-4 border-slate-600 group-hover:border-slate-500">
                                     <span className="text-2xl font-black text-slate-800 leading-none">01</span>
                                     <span className="text-xs font-bold text-slate-500 uppercase mt-1">Oct 2026</span>
                                 </div>
                                 <div className="flex-1">
                                     <span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-800 rounded uppercase tracking-wider mb-2">{t('circ3_tag')}</span>
                                     <h4 className="text-lg font-bold text-slate-900 group-hover:text-slate-600 transition-colors">{t('circ3_title')}</h4>
                                     <p className="text-sm text-slate-600 mt-1">{t('circ3_desc')}</p>
                                 </div>
                             </Link>
                         </div>
                     </div>
                     <div className="w-full md:w-1/3">
                          <div className="bg-[#f8f9fa] p-8 rounded-xl border-t-[6px] border-[#0A274B] shadow-lg relative">
                              <div className="absolute top-0 right-0 mt-4 mr-4 text-4xl opacity-10 font-serif font-bold italic">G</div>
                              <h3 className="text-xl font-black text-slate-900 border-b border-slate-200 pb-4 mb-6">{t('landing_key_directives')}</h3>
                              <ul className="space-y-4">
                                  <li>
                                      <Link to="/resources" className="flex items-center justify-between group">
                                          <span className="text-sm font-bold text-slate-700 group-hover:text-red-600">{t('landing_ceo_directory')}</span>
                                          <span className="text-red-500 group-hover:translate-x-1 transition-transform">→</span>
                                      </Link>
                                  </li>
                                  <li>
                                      <Link to="/resources" className="flex items-center justify-between group">
                                          <span className="text-sm font-bold text-slate-700 group-hover:text-red-600">{t('landing_grievance')}</span>
                                          <span className="text-red-500 group-hover:translate-x-1 transition-transform">→</span>
                                      </Link>
                                  </li>
                                  <li>
                                      <Link to="/resources" className="flex items-center justify-between group">
                                          <span className="text-sm font-bold text-slate-700 group-hover:text-red-600">{t('landing_constitutional')}</span>
                                          <span className="text-red-500 group-hover:translate-x-1 transition-transform">→</span>
                                      </Link>
                                  </li>
                                  <li>
                                      <Link to="/resources" className="flex items-center justify-between group">
                                          <span className="text-sm font-bold text-slate-700 group-hover:text-red-600">{t('landing_tenders')}</span>
                                          <span className="text-red-500 group-hover:translate-x-1 transition-transform">→</span>
                                      </Link>
                                  </li>
                              </ul>

                              <div className="mt-8 p-6 bg-white border border-gray-200 rounded-lg text-center shadow-sm">
                                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                      <span className="text-2xl text-blue-800 font-black">!</span>
                                  </div>
                                  <h4 className="font-bold text-slate-900 text-sm">{t('voter_helpline')}</h4>
                                  <p className="text-xs text-slate-500 mt-1 mb-3">{t('voter_helpline_desc')}</p>
                                  <Link to="/resources" className="block bg-[#0A274B] text-white text-xs text-center font-bold px-4 py-2 rounded shadow hover:bg-slate-800 transition-colors w-full">{t('voter_access')}</Link>
                              </div>
                          </div>
                     </div>
                </div>
            </section>

            {/* VERIFICATION WORKFLOW SECTION */}
            <section className="py-16 bg-white relative overflow-hidden">
                <div className="max-w-[1200px] mx-auto px-4 relative z-10">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">{t('wf_title')}</h2>
                        <p className="text-slate-500 font-medium">{t('wf_desc')}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                        {[
                            { step: '01', title: t('wf_s1'), desc: t('wf_s1_d'), icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
                            { step: '02', title: t('wf_s2'), desc: t('wf_s2_d'), icon: ShieldCheck, color: 'text-orange-600', bg: 'bg-orange-50' },
                            { step: '03', title: t('wf_s3'), desc: t('wf_s3_d'), icon: UserCheck, color: 'text-purple-600', bg: 'bg-purple-50' },
                            { step: '04', title: t('wf_s4'), desc: t('wf_s4_d'), icon: Fingerprint, color: 'text-red-600', bg: 'bg-red-50' },
                            { step: '05', title: t('wf_s5'), desc: t('wf_s5_d'), icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' }
                        ].map((item, idx) => (
                            <div key={idx} className="relative group">
                                <div className="h-full bg-white p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 hover:-translate-y-2 flex flex-col items-center text-center">
                                    <div className={`w-16 h-16 ${item.bg} ${item.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                                        <item.icon className="w-8 h-8" strokeWidth={2.5} />
                                    </div>
                                    <div className="absolute top-6 right-8 text-4xl font-black text-slate-50 opacity-10 group-hover:opacity-20 transition-opacity">
                                        {item.step}
                                    </div>
                                    <h4 className="font-black text-slate-900 mb-3 text-lg leading-tight">{item.title}</h4>
                                    <p className="text-sm text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                                </div>
                                {idx < 4 && (
                                    <div className="hidden lg:block absolute top-1/2 -right-4 -translate-y-1/2 z-20">
                                        <div className="w-8 h-8 bg-white rounded-full border border-slate-100 shadow-sm flex items-center justify-center text-slate-300">
                                            →
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                {/* Decorative Background Element */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-slate-50 rounded-full blur-[120px] -z-0"></div>
            </section>
            <section className="py-12 md:py-16 bg-[#111] text-white">
                <div className="max-w-[1200px] mx-auto px-4 text-center">
                    <h2 className="mb-8 text-slate-400 font-bold uppercase tracking-[0.2em] text-xs">{t('stats_title')}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                        <div className="py-6 md:py-0">
                            <div className="text-6xl font-black mb-3 text-red-500 tracking-tighter">{stats.nodes.replace("+", "")}<span className="text-3xl">+</span></div>
                            <div className="text-slate-400 font-medium uppercase text-xs tracking-wider">{t('stats_nodes')}</div>
                        </div>
                        <div className="py-6 md:py-0">
                            <div className="text-6xl font-black mb-3 text-orange-400 tracking-tighter">{stats.verified.replace("K", "")}{stats.verified.includes('K') && <span className="text-3xl">K</span>}</div>
                            <div className="text-slate-400 font-medium uppercase text-xs tracking-wider">{t('stats_verified')}</div>
                        </div>
                        <div className="py-6 md:py-0">
                            <div className="text-6xl font-black mb-3 text-red-600 tracking-tighter">{stats.fraud}</div>
                            <div className="text-slate-400 font-medium uppercase text-xs tracking-wider">{t('stats_fraud')}</div>
                        </div>
                    </div>
                </div>
            </section>


            {/* QUICK RESOURCES */}
            <section className="py-12 bg-white">
                <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row gap-8">
                     <div className="md:w-1/4 p-8 bg-slate-50 rounded-xl border-t-[6px] border-slate-700 shadow-md">
                         <h3 className="text-xl font-black mb-6 text-slate-900 border-b border-slate-200 pb-2">{t('landing_important_links')}</h3>
                         <ul className="space-y-4 text-sm text-blue-700 font-semibold">
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/about" className="hover:underline hover:text-red-600 transition">{t('landing_about_initiative')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/terms" className="hover:underline hover:text-red-600 transition">{t('landing_terms')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/privacy" className="hover:underline hover:text-red-600 transition">{t('landing_privacy')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/copyright" className="hover:underline hover:text-red-600 transition">{t('landing_copyright')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/disclaimer" className="hover:underline hover:text-red-600 transition">{t('landing_disclaimer')}</Link>
                             </li>
                         </ul>
                     </div>
                     <div className="md:w-1/4 p-8 bg-slate-50 rounded-xl border-t-[6px] border-[#de2b2b] shadow-md">
                         <h3 className="text-xl font-black mb-6 text-slate-900 border-b border-slate-200 pb-2">{t('landing_booth_operators')}</h3>
                         <ul className="space-y-4 text-sm text-blue-700 font-semibold">
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_download_sops')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_hardware_list')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_faq_auth')}</Link>
                             </li>
                         </ul>
                     </div>
                     <div className="md:w-1/4 p-8 bg-white rounded-xl border-t-[6px] border-slate-900 shadow-xl scale-105 z-10 transition-transform hover:scale-110">
                         <h3 className="text-xl font-black mb-6 text-slate-900 border-b border-slate-200 pb-2">{t('landing_sys_admins')}</h3>
                         <ul className="space-y-4 text-sm text-blue-700 font-semibold">
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_provisioning')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_time_window')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_audit_logs')}</Link>
                             </li>
                         </ul>
                     </div>
                     <div className="md:w-1/4 p-8 bg-slate-50 rounded-xl border-t-[6px] border-slate-700 shadow-md">
                         <h3 className="text-xl font-black mb-6 text-slate-900 border-b border-slate-200 pb-2">{t('landing_public_media')}</h3>
                         <ul className="space-y-4 text-sm text-blue-700 font-semibold">
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_protocol_overview')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/resources" className="hover:underline hover:text-red-600 transition">{t('landing_whitepaper')}</Link>
                             </li>
                             <li className="flex items-start gap-2">
                                <span className="text-red-500">▶</span> <Link to="/about" className="hover:underline hover:text-red-600 transition">{t('landing_manifesto')}</Link>
                             </li>
                         </ul>
                     </div>
                </div>
            </section>

            {/* GOVERNMENT LOGO STRIP (Trust Signals) */}
            <div className="py-12 bg-gray-50 border-t border-gray-200 overflow-hidden">
                <div className="max-w-[1200px] mx-auto px-4 flex flex-wrap justify-around items-center gap-12 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition duration-500">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-8 h-8 text-slate-700" />
                        <span className="font-black text-slate-800 tracking-tighter text-xl italic uppercase">{t('trust_cyber')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white font-black">A</div>
                        <span className="font-bold text-slate-800 text-sm">{t('trust_aadhaar')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-black text-red-600 text-2xl tracking-[0.2em] italic border-b-2 border-slate-800">NIC</span>
                        <span className="text-[10px] font-bold text-slate-500 max-w-[80px] leading-tight uppercase">{t('trust_nic')}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 border-2 border-slate-800 rounded-lg flex items-center justify-center text-slate-800 font-serif font-black overflow-hidden relative">
                           <span className="z-10 text-xs">GOI</span>
                           <div className="absolute inset-0 bg-orange-100 opacity-30"></div>
                        </div>
                        <span className="font-bold text-slate-800 text-sm">{t('trust_goi')}</span>
                    </div>
                </div>
            </div>

            {/* UNIVERSAL FOOTER */}
            <Footer />
        </div>
    );
};

export default Landing;
