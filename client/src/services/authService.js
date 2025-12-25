import api from './api';

export const authService = {
    // Register new user
    async register(userData) {
        const response = await api.post('/auth/register', userData);
        if (response.data.success) {
            const { user, accessToken, refreshToken } = response.data.data;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));
        }
        return response.data;
    },

    // Login user
    async login(email, password) {
        const response = await api.post('/auth/login', { email, password });
        if (response.data.success) {
            const { user, accessToken, refreshToken } = response.data.data;
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));
        }
        return response.data;
    },

    // Logout user
    async logout() {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        }
    },

    // Get current user profile
    async getProfile() {
        const response = await api.get('/auth/me');
        return response.data;
    },

    // Update profile
    async updateProfile(data) {
        const response = await api.put('/auth/profile', data);
        if (response.data.success) {
            localStorage.setItem('user', JSON.stringify(response.data.data.user));
        }
        return response.data;
    },

    // Change password
    async changePassword(currentPassword, newPassword) {
        const response = await api.put('/auth/password', { currentPassword, newPassword });
        return response.data;
    },

    // Check if user is authenticated
    isAuthenticated() {
        return !!localStorage.getItem('accessToken');
    },

    // Get stored user
    getStoredUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },

    // Get access token
    getAccessToken() {
        return localStorage.getItem('accessToken');
    }
};

export default authService;
