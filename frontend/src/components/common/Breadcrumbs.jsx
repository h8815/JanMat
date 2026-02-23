import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Breadcrumbs = ({ customMappings = {} }) => {
    const location = useLocation();
    const { user } = useAuth();
    const pathnames = location.pathname.split('/').filter((x) => x);

    // Default route name mappings for better readability
    const defaultMappings = {
        'admin-dashboard': 'Admin Dashboard',
        'operator-dashboard': 'Operator Dashboard',
        'admin': 'Admin',
        'operator': 'Operator',
        'report-fraud': 'Report Fraud',
        'verify': 'Voter Verification',
        ...customMappings
    };

    // Fix: Redirection fixes for intermediate non-routable segments
    const linkOverrides = {
        '/operator': '/operator-dashboard',
        '/admin': '/admin-dashboard'
    };

    const getRouteName = (segment) => {
        if (defaultMappings[segment]) {
            return defaultMappings[segment];
        }
        // Capitalize the first letter and replace hyphens with spaces as a fallback
        return segment
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    if (pathnames.length === 0) return null;

    // Determine correct home link based on role
    const homeLink = user?.role === 'ADMIN'
        ? '/admin-dashboard'
        : (user?.role === 'OPERATOR' ? '/operator-dashboard' : '/');

    return (
        <nav aria-label="breadcrumb" className="mb-4">
            <ol className="flex items-center space-x-2 text-sm text-slate-500">
                <li>
                    <Link to={homeLink} className="flex items-center hover:text-janmat-blue transition-colors">
                        <Home className="w-4 h-4" />
                        <span className="sr-only">Home</span>
                    </Link>
                </li>

                {pathnames.map((value, index) => {
                    const isLast = index === pathnames.length - 1;
                    const rawTo = `/${pathnames.slice(0, index + 1).join('/')}`;
                    const to = linkOverrides[rawTo] || rawTo;

                    return (
                        <li key={to} className="flex items-center">
                            <ChevronRight className="w-4 h-4 mx-1 text-slate-400" />
                            {isLast ? (
                                <span className="font-semibold text-slate-800" aria-current="page">
                                    {getRouteName(value)}
                                </span>
                            ) : (
                                <Link to={to} className="hover:text-janmat-blue transition-colors">
                                    {getRouteName(value)}
                                </Link>
                            )}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
};

export default Breadcrumbs;
