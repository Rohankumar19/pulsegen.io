import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import videoService from '../services/videoService';
import { useSocket } from './SocketContext';

const VideoContext = createContext(null);

export function VideoProvider({ children }) {
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        pages: 0
    });
    const [filters, setFilters] = useState({
        status: null,
        classification: null,
        sortBy: 'createdAt',
        sortOrder: 'desc'
    });

    const { onVideoProgress, onVideoComplete, onVideoError } = useSocket();

    // Fetch videos
    const fetchVideos = useCallback(async (page = 1) => {
        setLoading(true);
        setError(null);
        try {
            const response = await videoService.getVideos({
                page,
                limit: pagination.limit,
                ...filters
            });

            if (response.success) {
                setVideos(response.data.videos);
                setPagination(response.data.pagination);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch videos');
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.limit]);

    // Listen for real-time updates
    useEffect(() => {
        const unsubProgress = onVideoProgress((data) => {
            setVideos(prev => prev.map(video =>
                video._id === data.videoId
                    ? {
                        ...video,
                        processingProgress: data.progress,
                        processingStage: data.stage,
                        status: data.status
                    }
                    : video
            ));
        });

        const unsubComplete = onVideoComplete((data) => {
            setVideos(prev => prev.map(video =>
                video._id === data.videoId
                    ? {
                        ...video,
                        status: 'completed',
                        processingProgress: 100,
                        processingStage: 'done',
                        sensitivityResult: data.sensitivityResult
                    }
                    : video
            ));
        });

        const unsubError = onVideoError((data) => {
            setVideos(prev => prev.map(video =>
                video._id === data.videoId
                    ? {
                        ...video,
                        status: 'failed',
                        processingError: data.error
                    }
                    : video
            ));
        });

        return () => {
            unsubProgress();
            unsubComplete();
            unsubError();
        };
    }, [onVideoProgress, onVideoComplete, onVideoError]);

    // Upload video
    const uploadVideo = useCallback(async (file, metadata, onProgress) => {
        try {
            const response = await videoService.upload(file, metadata, onProgress);
            if (response.success) {
                // Refresh videos list
                await fetchVideos(1);
                return { success: true, video: response.data.video };
            }
            throw new Error(response.message);
        } catch (err) {
            return {
                success: false,
                error: err.response?.data?.message || err.message
            };
        }
    }, [fetchVideos]);

    // Delete video
    const deleteVideo = useCallback(async (id) => {
        try {
            const response = await videoService.deleteVideo(id);
            if (response.success) {
                setVideos(prev => prev.filter(v => v._id !== id));
                return { success: true };
            }
            throw new Error(response.message);
        } catch (err) {
            return {
                success: false,
                error: err.response?.data?.message || err.message
            };
        }
    }, []);

    // Update filters
    const updateFilters = useCallback((newFilters) => {
        setFilters(prev => ({ ...prev, ...newFilters }));
    }, []);

    // Clear filters
    const clearFilters = useCallback(() => {
        setFilters({
            status: null,
            classification: null,
            sortBy: 'createdAt',
            sortOrder: 'desc'
        });
    }, []);

    const value = {
        videos,
        loading,
        error,
        pagination,
        filters,
        fetchVideos,
        uploadVideo,
        deleteVideo,
        updateFilters,
        clearFilters
    };

    return (
        <VideoContext.Provider value={value}>
            {children}
        </VideoContext.Provider>
    );
}

export function useVideos() {
    const context = useContext(VideoContext);
    if (!context) {
        throw new Error('useVideos must be used within a VideoProvider');
    }
    return context;
}

export default VideoContext;
