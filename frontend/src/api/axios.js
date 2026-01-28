import axios from 'axios';

const api = axios.create({
    baseURL: 'http://127.0.0.1:8000/api',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Skip auth refresh for login endpoints
        if (originalRequest.url.includes('/login/') || originalRequest.url.includes('/token/refresh/')) {
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                const refreshToken = localStorage.getItem('refresh_token');
                if (!refreshToken) throw new Error('No refresh token');

                const response = await axios.post('http://127.0.0.1:8000/api/auth/token/refresh/', {
                    refresh: refreshToken,
                });

                localStorage.setItem('access_token', response.data.access);
                api.defaults.headers.common.Authorization = `Bearer ${response.data.access}`;
                return api(originalRequest);
            } catch (refreshError) {
                localStorage.clear();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);

export default api;
