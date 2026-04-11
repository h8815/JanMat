/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';
import { ROLES } from '../constants/roles';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchUser = async () => {
        try {
            const response = await api.get('/auth/current-user/');
            const userData = response.data.user;
            if (response.data.role) userData.role = response.data.role;
            setUser(userData);
        } catch (error) {
            console.error("Failed to fetch user profile", error);
            // This could eventually trigger unauthorized if api fails
        }
    };

    const logout = useCallback((reasonMsg = null) => {
        const role = user?.role;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        
        let path = '/login';
        if (role === ROLES.OPERATOR) path = '/login?role=operator';
        else if (role === ROLES.ADMIN) path = '/login?role=admin';

        if (reasonMsg && typeof reasonMsg === 'string') {
            sessionStorage.setItem('logoutReason', reasonMsg);
            window.location.href = path;
        } else {
            navigate(path);
        }
    }, [user, navigate]);

    useEffect(() => {
        const handleUnauthorized = (e) => {
            console.warn('Unauthorized event caught. Logging out.');
            const reason = e.detail?.detail || e.detail?.error || 'Your session has expired due to inactivity or credential closing.';
            logout(reason);
        };

        window.addEventListener('unauthorized', handleUnauthorized);
        return () => window.removeEventListener('unauthorized', handleUnauthorized);
    }, [logout]);

    const initAuth = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                jwtDecode(token);
                await fetchUser();
            } catch (e) {
                console.error("Invalid token found", e);
                logout();
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        initAuth();
    }, []);

    useEffect(() => {
        let timeoutId;
        if (user && user.valid_until) {
            const validUntilTime = new Date(user.valid_until).getTime();
            const now = new Date().getTime();
            const timeRemaining = validUntilTime - now;

            if (timeRemaining > 0 && timeRemaining <= 2147483647) {
                // Schedule forced logout precisely when the credential window closes
                timeoutId = setTimeout(() => {
                    const eventMsg = { detail: 'Credential access window has expired / प्रमाण-पत्र की वैधता समाप्त हो गई है', code: 'access_expired' };
                    window.dispatchEvent(new CustomEvent('unauthorized', { detail: eventMsg }));
                }, timeRemaining);
            } else if (timeRemaining <= 0) {
                // If it's already expired somehow
                const eventMsg = { detail: 'Credential access window has expired / प्रमाण-पत्र की वैधता समाप्त हो गई है', code: 'access_expired' };
                window.dispatchEvent(new CustomEvent('unauthorized', { detail: eventMsg }));
            }
        }
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [user]);

    const login = async (email, password, endpoint) => {
        try {
            const response = await api.post(endpoint, { username: email, password });

            if (response.data.must_change_password) {
                return { requiresPasswordReset: true, username: email };
            }

            const { access, refresh, user: userData, role: responseRole } = response.data;
            const role = responseRole || ROLES.UNKNOWN;

            if (role === ROLES.SUPERUSER) {
                throw new Error('Invalid role found in token');
            }

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            if (userData) {
                setUser(userData);
            } else {
                setUser({ id: jwtDecode(access).user_id, role, ...jwtDecode(access) });
                fetchUser();
            }

            return true;
        } catch (error) {
            console.error("Login failed", error);
            // Surface validity window errors with a structured payload so Login.jsx
            // can display the correct bilingual institutional message.
            const errorCode = error.response?.data?.error_code;
            if (errorCode === 'ACCESS_EXPIRED') {
                throw Object.assign(new Error('ACCESS_EXPIRED'), {
                    errorCode: 'ACCESS_EXPIRED',
                    message: 'Credential access window has expired / प्रमाण-पत्र की वैधता समाप्त हो गई है।',
                });
            }
            if (errorCode === 'ACCESS_NOT_STARTED') {
                throw Object.assign(new Error('ACCESS_NOT_STARTED'), {
                    errorCode: 'ACCESS_NOT_STARTED',
                    message: 'Credential access window has not started yet / प्रमाण-पत्र अभी सक्रिय नहीं हुआ।',
                });
            }
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
