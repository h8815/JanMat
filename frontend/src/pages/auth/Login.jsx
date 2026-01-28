import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const Login = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login } = useAuth();

    const roleParam = searchParams.get('role');
    const role = roleParam === 'operator' ? 'OPERATOR' : 'ADMIN';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        // Basic validtion or redirection if needed
    }, [role]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = role === 'ADMIN' ? '/auth/admin/login/' : '/auth/operator/login/';

            await login(email, password, endpoint, role);

            // Redirect based on role
            if (role === 'ADMIN') {
                navigate('/admin-dashboard');
            } else {
                navigate('/operator-dashboard');
            }
        } catch (err) {
            setError(err.message || 'Invalid credentials. Please contact support.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-tricolor relative">
            <div className="absolute inset-0 bg-black/55"></div>

            <main className="relative z-10 min-h-screen flex items-center justify-center p-6">
                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-8 items-center">

                    {/* Left Side: Branding */}
                    <div className="md:col-span-1 text-center md:text-left px-6">
                        <img
                            src="/assets/images/ashoka.png"
                            alt="Ashoka Emblem"
                            className="mx-auto md:mx-0 w-20 h-20 object-contain"
                            onError={(e) => { e.target.src = 'https://placehold.co/80x80?text=Emblem'; }}
                        />
                        <h1 className="mt-4 text-2xl font-semibold text-white">
                            {role === 'ADMIN' ? 'Admin Portal' : 'Operator Portal'} — JanMat
                        </h1>
                        <p className="mt-2 text-slate-200 max-w-sm">
                            {role === 'ADMIN'
                                ? 'Restricted access for Election Commission administrators.'
                                : 'Restricted access for polling booth operators.'
                            } All access is logged and audited.
                        </p>
                        <Link to="/" className="inline-block mt-6 text-sm text-white underline">
                            Back to Role Selection
                        </Link>
                    </div>

                    {/* Right Side: Form */}
                    <div className="md:col-span-2">
                        <div className="bg-white rounded-lg p-8 card-shadow border border-slate-200 max-w-xl mx-auto">
                            <form onSubmit={handleSubmit} noValidate>
                                <div className="mb-6">
                                    <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="mt-2 w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none"
                                        placeholder="name@janmat.gov.in"
                                    />
                                </div>

                                <div className="mb-4">
                                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">Password</label>
                                    <div className="relative mt-2">
                                        <input
                                            id="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-offset-1 focus:ring-janmat-blue outline-none pr-10"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700"
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-6">
                                    <label className="inline-flex items-center text-sm">
                                        <input type="checkbox" className="h-4 w-4 text-janmat-blue border-slate-300 rounded" />
                                        <span className="ml-2 text-slate-700">Remember this device</span>
                                    </label>
                                </div>

                                <div>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full px-4 py-3 bg-janmat-blue text-white font-medium rounded-md hover:bg-janmat-hover focus:ring-2 focus:ring-offset-1 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        <span>{loading ? 'Signing in...' : 'Sign in'}</span>
                                    </button>
                                </div>

                                {error && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 flex gap-2 items-start">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <p className="mt-4 text-xs text-slate-500">
                                    Access is restricted to authorized Election Commission staff. All access is logged.
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Login;
