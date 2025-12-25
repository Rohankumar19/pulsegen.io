import api from './api';

export const videoService = {
    // Upload video
    async upload(file, metadata = {}, onProgress) {
        const formData = new FormData();
        formData.append('video', file);

        if (metadata.title) formData.append('title', metadata.title);
        if (metadata.description) formData.append('description', metadata.description);
        if (metadata.tags) formData.append('tags', JSON.stringify(metadata.tags));

        const response = await api.post('/videos/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
                if (onProgress) {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    onProgress(percentCompleted);
                }
            }
        });

        return response.data;
    },

    // Get all videos
    async getVideos(params = {}) {
        const response = await api.get('/videos', { params });
        return response.data;
    },

    // Get single video
    async getVideo(id) {
        const response = await api.get(`/videos/${id}`);
        return response.data;
    },

    // Update video
    async updateVideo(id, data) {
        const response = await api.patch(`/videos/${id}`, data);
        return response.data;
    },

    // Delete video
    async deleteVideo(id) {
        const response = await api.delete(`/videos/${id}`);
        return response.data;
    },

    // Share video
    async shareVideo(id, userIds) {
        const response = await api.post(`/videos/${id}/share`, { userIds });
        return response.data;
    },

    // Reprocess video
    async reprocessVideo(id) {
        const response = await api.post(`/videos/${id}/reprocess`);
        return response.data;
    },

    // Get stream URL
    getStreamUrl(id) {
        const token = localStorage.getItem('accessToken');
        return `${import.meta.env.VITE_API_URL}/stream/${id}?token=${token}`;
    },

    // Get thumbnail URL
    getThumbnailUrl(id) {
        const token = localStorage.getItem('accessToken');
        return `${import.meta.env.VITE_API_URL}/stream/${id}/thumbnail?token=${token}`;
    },

    // Get stream info
    async getStreamInfo(id) {
        const response = await api.get(`/stream/${id}/info`);
        return response.data;
    }
};

export default videoService;
