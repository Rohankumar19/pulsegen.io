import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initialize auth state
    useEffect(() => {
        const initAuth = async () => {
            try {
                const storedUser = authService.getStoredUser();
                if (storedUser && authService.isAuthenticated()) {
                    // Verify token is valid by fetching profile
                    const response = await authService.getProfile();
                    if (response.success) {
                        setUser(response.data.user);
                    }
                }
            } catch (err) {
                console.error('Auth init error:', err);
                // Token invalid - clear storage
                await authService.logout();
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    const login = useCallback(async (email, password) => {
        setError(null);
        try {
            const response = await authService.login(email, password);
            if (response.success) {
                setUser(response.data.user);
                return { success: true };
            }
            throw new Error(response.message);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Login failed';
            setError(message);
            return { success: false, error: message };
        }
    }, []);

    const register = useCallback(async (userData) => {
        setError(null);
        try {
            const response = await authService.register(userData);
            if (response.success) {
                setUser(response.data.user);
                return { success: true };
            }
            throw new Error(response.message);
        } catch (err) {
            const message = err.response?.data?.message || err.message || 'Registration failed';
            setError(message);
            return { success: false, error: message };
        }
    }, []);

    const logout = useCallback(async () => {
        await authService.logout();
        setUser(null);
    }, []);

    const updateProfile = useCallback(async (data) => {
        try {
            const response = await authService.updateProfile(data);
            if (response.success) {
                setUser(response.data.user);
                return { success: true };
            }
            throw new Error(response.message);
        } catch (err) {
            const message = err.response?.data?.message || err.message;
            return { success: false, error: message };
        }
    }, []);

    const value = {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isEditor: user?.role === 'editor' || user?.role === 'admin',
        login,
        register,
        logout,
        updateProfile,
        clearError: () => setError(null)
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;
