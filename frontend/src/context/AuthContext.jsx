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
                if (decoded.exp * 1000 < Date.now()) {
                    logout();
                } else {
                    // Fetch full profile to get name and other details not in token
                    await fetchUser();
                }
            } catch (e) {
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
            const response = await api.post(endpoint, { email, password });
            const { access, refresh, user: userData } = response.data;

            const decoded = jwtDecode(access);
            const role = decoded.role || 'UNKNOWN';

            if (role === 'SUPERUSER') {
                throw new Error('SuperAdmins must use the Backend Admin Portal.');
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
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
