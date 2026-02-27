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

    const logout = useCallback(() => {
        const role = user?.role;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        if (role === ROLES.OPERATOR) {
            navigate('/login?role=operator');
        } else {
            navigate('/login?role=admin');
        }
    }, [user, navigate]);

    useEffect(() => {
        const handleUnauthorized = () => {
            console.warn('Unauthorized event caught. Logging out.');
            logout();
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
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
