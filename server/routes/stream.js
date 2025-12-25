import express from 'express';
import fs from 'fs';
import path from 'path';
import Video from '../models/Video.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/stream/:id
// @desc    Stream video with range request support
// @access  Private (with access check)
router.get('/:id', authenticate, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Check access
        if (!video.canAccess(req.user._id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check if video is processed
        if (video.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Video is still processing'
            });
        }

        const videoPath = video.filePath;

        // Check if file exists
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({
                success: false,
                message: 'Video file not found'
            });
        }

        const stat = fs.statSync(videoPath);
        const fileSize = stat.size;
        const range = req.headers.range;

        // Increment view count (only once per session/request without range or at start)
        if (!range || range === 'bytes=0-') {
            await Video.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
        }

        if (range) {
            // Handle range request for video seeking
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

            // Validate range
            if (start >= fileSize) {
                res.status(416).send('Requested range not satisfiable');
                return;
            }

            const chunksize = (end - start) + 1;
            const file = fs.createReadStream(videoPath, { start, end });

            const headers = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': video.mimetype
            };

            res.writeHead(206, headers);
            file.pipe(res);
        } else {
            // No range request - send entire file
            const headers = {
                'Content-Length': fileSize,
                'Content-Type': video.mimetype,
                'Accept-Ranges': 'bytes'
            };

            res.writeHead(200, headers);
            fs.createReadStream(videoPath).pipe(res);
        }
    } catch (error) {
        console.error('Stream error:', error);

        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error during streaming'
        });
    }
});

// @route   GET /api/stream/:id/thumbnail
// @desc    Get video thumbnail
// @access  Private (with access check)
router.get('/:id/thumbnail', authenticate, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Check access
        if (!video.canAccess(req.user._id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check if thumbnail exists
        if (!video.thumbnailPath || !fs.existsSync(video.thumbnailPath)) {
            // Return a placeholder or 404
            return res.status(404).json({
                success: false,
                message: 'Thumbnail not available'
            });
        }

        res.sendFile(video.thumbnailPath);
    } catch (error) {
        console.error('Thumbnail error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/stream/:id/info
// @desc    Get video streaming info
// @access  Private (with access check)
router.get('/:id/info', authenticate, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id)
            .select('title duration resolution mimetype size status');

        if (!video) {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        // Check access
        if (!video.canAccess(req.user._id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        res.json({
            success: true,
            data: {
                title: video.title,
                duration: video.duration,
                formattedDuration: video.formattedDuration,
                resolution: video.resolution,
                mimetype: video.mimetype,
                size: video.size,
                formattedSize: video.formattedSize,
                status: video.status,
                streamUrl: `/api/stream/${video._id}`
            }
        });
    } catch (error) {
        console.error('Stream info error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;
