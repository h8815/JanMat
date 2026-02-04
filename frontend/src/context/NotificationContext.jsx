import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../api/axios";
import { toast } from "react-hot-toast";

const NotificationContext = createContext();

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnreadCount = async (silent = true) => {
        try {
            const response = await api.get("/auth/admin/notifications/unread-count/");
            const newCount = response.data.unread_count;

            setUnreadCount((prevCount) => {
                if (newCount > prevCount && !silent) {
                    toast(`⚠️ ${newCount - prevCount} new fraud alert(s)!`, {
                        icon: "🚨",
                        style: {
                            borderRadius: "10px",
                            background: "#333",
                            color: "#fff",
                        },
                    });
                }
                return newCount;
            });
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        }
    };

    useEffect(() => {
        // Initial fetch
        fetchUnreadCount(true);

        // Poll every 30 seconds
        const interval = setInterval(() => {
            fetchUnreadCount(false);
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    const markAllAsRead = async () => {
        try {
            await api.post("/auth/admin/notifications/mark-all-reviewed/");
            setUnreadCount(0);
            toast.success("All notifications cleared!");
        } catch (error) {
            console.error("Failed to clear notifications:", error);
            toast.error("Failed to clear notifications");
        }
    };

    return (
        <NotificationContext.Provider value={{ unreadCount, refreshNotifications: () => fetchUnreadCount(true), markAllAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};
