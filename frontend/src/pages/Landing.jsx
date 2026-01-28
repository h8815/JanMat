import React from 'react';
import { Link } from 'react-router-dom';

const Landing = () => {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-tricolor relative">
            <div className="absolute inset-0 bg-black/55"></div>

            <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
                <section className="w-full max-w-3xl">
                    <div className="mx-auto bg-white/95 rounded-lg shadow card-shadow border border-slate-200 overflow-hidden max-w-[720px]">
                        <div className="p-8 md:p-10">
                            <header className="flex items-center gap-4">
                                <img
                                    src="/assets/images/ashoka-black.png"
                                    alt="Ashoka Emblem"
                                    className="w-12 h-12 object-contain"
                                    onError={(e) => { e.target.src = 'https://placehold.co/48x48?text=Emblem'; }} // Fallback
                                />
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 leading-tight">JanMat</h1>
                                    <p className="text-slate-600 mt-1">Secure Voter Verification for Booths</p>
                                </div>
                            </header>

                            <div className="mt-8">
                                <div role="region" aria-label="Select your role" className="space-y-4">
                                    <div className="flex flex-col gap-3">
                                        <Link
                                            to="/login?role=admin"
                                            className="inline-flex items-center justify-center px-5 py-3 bg-janmat-blue text-white font-medium rounded-md focus:ring-2 focus:ring-offset-2 hover:bg-janmat-hover transition-colors"
                                        >
                                            Sign in as Admin
                                        </Link>
                                        <p className="text-sm text-slate-600 pl-1">Access for Election Commission administrators</p>
                                    </div>

                                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                                        <Link
                                            to="/login?role=operator"
                                            className="inline-flex items-center justify-center px-5 py-3 bg-white border border-janmat-blue text-janmat-blue font-medium rounded-md focus:ring-2 focus:ring-offset-2 hover:bg-janmat-light transition-colors"
                                        >
                                            Sign in as Booth Operator
                                        </Link>
                                        <p className="text-sm text-slate-600 pl-1">Access for registered booth operators</p>
                                    </div>
                                </div>
                            </div>

                            <footer className="mt-8 flex items-center justify-between text-sm text-slate-500">
                                <div className="flex items-center gap-2">
                                    <svg className="w-4 h-4 text-slate-600" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.866-3.582 7-8 7v-7h16v7c-4.418 0-8-3.134-8-7z" />
                                    </svg>
                                    <span>Secure connection (HTTPS)</span>
                                </div>
                                <div>© {currentYear} Election Commission</div>
                            </footer>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default Landing;
