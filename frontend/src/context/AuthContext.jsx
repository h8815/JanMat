import { createContext, useContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import api from '../api/axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = async () => {
        try {
            const response = await api.get('/auth/current-user/');
            // response.data = { role: '...', user: { ... }, admin_id: ... }
            // We want the user object, potentially with role added if missing
            const userData = response.data.user;
            if (response.data.role) userData.role = response.data.role;
            setUser(userData);
        } catch (error) {
            console.error("Failed to fetch user profile", error);
            logout();
        }
    };

    const initAuth = async () => {
        const token = localStorage.getItem('access_token');
        if (token) {
            try {
                const decoded = jwtDecode(token);
                // Allow axios interceptor to handle 401/refresh if token is expired
                await fetchUser();
            } catch (e) {
                // If token is malformed, then logout
                console.error("Invalid token found", e);
                logout();
            }
        }
        setLoading(false);
    };

    useEffect(() => {
        initAuth();
    }, []);

    const login = async (email, password, endpoint, expectedRole) => {
        try {
            // Send email as username since backend serializers now expect 'username' for both Admin and Operator
            const response = await api.post(endpoint, { username: email, password });

            // Catch the forced password change scenario
            if (response.data.must_change_password) {
                return { requiresPasswordReset: true, username: email };
            }

            const { access, refresh, user: userData } = response.data;

            const decoded = jwtDecode(access);
            const role = decoded.role || 'UNKNOWN';

            if (role === 'SUPERUSER') {
                throw new Error('Invalid role found in token');
            }

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            // Use the user data from response which typically contains name
            if (userData) {
                setUser(userData);
            } else {
                // Fallback if backend doesn't send user object (though it should)
                setUser({ id: decoded.user_id, role, ...decoded });
                fetchUser(); // Fetch in background to update details
            }

            return true;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = () => {
        const role = user?.role;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        if (role === 'OPERATOR') {
            window.location.href = '/login?role=operator';
        } else {
            window.location.href = '/login?role=admin';
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
