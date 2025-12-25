import { Server } from 'socket.io';

let io;

export const initializeSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: process.env.NODE_ENV === 'production'
                ? process.env.CLIENT_URL
                : ['http://localhost:5173', 'http://localhost:3000'],
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`🔌 Client connected: ${socket.id}`);

        // Subscribe to video processing updates
        socket.on('subscribe:video', (videoId) => {
            socket.join(`video:${videoId}`);
            console.log(`📺 Client ${socket.id} subscribed to video ${videoId}`);
        });

        // Unsubscribe from video updates
        socket.on('unsubscribe:video', (videoId) => {
            socket.leave(`video:${videoId}`);
            console.log(`📺 Client ${socket.id} unsubscribed from video ${videoId}`);
        });

        // Subscribe to user-specific updates
        socket.on('subscribe:user', (userId) => {
            socket.join(`user:${userId}`);
            console.log(`👤 Client ${socket.id} subscribed to user ${userId}`);
        });

        socket.on('disconnect', () => {
            console.log(`🔌 Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

// Emit video processing events
export const emitVideoProgress = (videoId, data) => {
    if (io) {
        io.to(`video:${videoId}`).emit('video:processing:progress', {
            videoId,
            ...data
        });
    }
};

export const emitVideoComplete = (videoId, data) => {
    if (io) {
        io.to(`video:${videoId}`).emit('video:processing:complete', {
            videoId,
            ...data
        });
    }
};

export const emitVideoError = (videoId, error) => {
    if (io) {
        io.to(`video:${videoId}`).emit('video:processing:error', {
            videoId,
            error: error.message || 'Processing failed'
        });
    }
};

export const emitUserNotification = (userId, notification) => {
    if (io) {
        io.to(`user:${userId}`).emit('notification', notification);
    }
};

export default { initializeSocket, getIO, emitVideoProgress, emitVideoComplete, emitVideoError };
