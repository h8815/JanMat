import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { jwtDecode } from 'jwt-decode';
import ConfirmationModal from './ConfirmationModal';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const SessionMonitor = () => {
    const { logout } = useAuth();
    const { t } = useTranslation();
    const [showWarning, setShowWarning] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            const token = localStorage.getItem('access_token');
            if (!token) return;

            try {
                const decoded = jwtDecode(token);
                const currentTime = Date.now();
                const expireTime = decoded.exp * 1000;
                const timeRemaining = expireTime - currentTime;

                // 5 minutes in milliseconds
                const fiveMins = 5 * 60 * 1000;

                if (timeRemaining <= 0) {
                    // Token expired
                    logout();
                } else if (timeRemaining < fiveMins && !showWarning) {
                    setShowWarning(true);
                }
            } catch (err) {
                console.error("SessionMonitor decode error:", err);
            }
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, [logout, showWarning]);

    const handleStayLoggedIn = async () => {
        try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (!refreshToken) throw new Error('No refresh token');

            const response = await axios.post('http://127.0.0.1:8000/api/auth/token/refresh/', {
                refresh: refreshToken,
            });

            localStorage.setItem('access_token', response.data.access);
            setShowWarning(false);
        } catch (error) {
            console.error("Failed to refresh session", error);
            logout();
        }
    };

    return (
        <ConfirmationModal
            isOpen={showWarning}
            onClose={() => setShowWarning(false)}
            onConfirm={handleStayLoggedIn}
            title={t('session_expiring_title') || "Session Expiring Soon"}
            message={t('session_expiring_message') || "Your session will expire in less than 5 minutes due to inactivity. Do you want to stay logged in?"}
            confirmText={t('btn_stay_logged_in') || "Stay Logged In"}
            cancelText={t('btn_logout') || "Log Out"}
            isDanger={true} // Use danger styling to grab attention
        />
    );
};

export default SessionMonitor;
