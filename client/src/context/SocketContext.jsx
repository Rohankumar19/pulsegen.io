import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

export function SocketProvider({ children }) {
    const [socket, setSocket] = useState(null);
    const [connected, setConnected] = useState(false);
    const { user, isAuthenticated } = useAuth();

    // Initialize socket connection
    useEffect(() => {
        if (!isAuthenticated) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
                setConnected(false);
            }
            return;
        }

        const newSocket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            autoConnect: true
        });

        newSocket.on('connect', () => {
            console.log('🔌 Socket connected:', newSocket.id);
            setConnected(true);

            // Subscribe to user-specific updates
            if (user?.id) {
                newSocket.emit('subscribe:user', user.id);
            }
        });

        newSocket.on('disconnect', () => {
            console.log('🔌 Socket disconnected');
            setConnected(false);
        });

        newSocket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, [isAuthenticated, user?.id]);

    // Subscribe to video updates
    const subscribeToVideo = useCallback((videoId) => {
        if (socket && connected) {
            socket.emit('subscribe:video', videoId);
        }
    }, [socket, connected]);

    // Unsubscribe from video updates
    const unsubscribeFromVideo = useCallback((videoId) => {
        if (socket && connected) {
            socket.emit('unsubscribe:video', videoId);
        }
    }, [socket, connected]);

    // Listen for video progress updates
    const onVideoProgress = useCallback((callback) => {
        if (socket) {
            socket.on('video:processing:progress', callback);
            return () => socket.off('video:processing:progress', callback);
        }
        return () => { };
    }, [socket]);

    // Listen for video completion
    const onVideoComplete = useCallback((callback) => {
        if (socket) {
            socket.on('video:processing:complete', callback);
            return () => socket.off('video:processing:complete', callback);
        }
        return () => { };
    }, [socket]);

    // Listen for video errors
    const onVideoError = useCallback((callback) => {
        if (socket) {
            socket.on('video:processing:error', callback);
            return () => socket.off('video:processing:error', callback);
        }
        return () => { };
    }, [socket]);

    // Listen for notifications
    const onNotification = useCallback((callback) => {
        if (socket) {
            socket.on('notification', callback);
            return () => socket.off('notification', callback);
        }
        return () => { };
    }, [socket]);

    const value = {
        socket,
        connected,
        subscribeToVideo,
        unsubscribeFromVideo,
        onVideoProgress,
        onVideoComplete,
        onVideoError,
        onNotification
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
}

export default SocketContext;
