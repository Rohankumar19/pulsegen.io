import express from 'express';
import { body, query, validationResult } from 'express-validator';
import Video from '../models/Video.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission, requireOwnerOrAdmin } from '../middleware/rbac.js';
import { handleVideoUpload, deleteVideoFile, deleteThumbnail } from '../middleware/upload.js';
import { processingQueue } from '../services/videoProcessor.js';
import path from 'path';

const router = express.Router();

// @route   POST /api/videos/upload
// @desc    Upload a new video
// @access  Private (Editor, Admin)
router.post('/upload',
    authenticate,
    requirePermission('video:upload'),
    handleVideoUpload,
    [
        body('title')
            .optional()
            .trim()
            .isLength({ max: 200 })
            .withMessage('Title cannot exceed 200 characters'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 2000 })
            .withMessage('Description cannot exceed 2000 characters'),
        body('tags')
            .optional()
            .isArray()
            .withMessage('Tags must be an array')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Delete uploaded file if validation fails
                if (req.file) {
                    await deleteVideoFile(req.file.path);
                }
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const { title, description, tags } = req.body;

            // Create video record
            const video = new Video({
                title: title || req.file.originalname.replace(/\.[^/.]+$/, ''),
                description: description || '',
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                owner: req.user._id,
                organization: req.user.organization,
                filePath: req.file.path,
                tags: tags || [],
                status: 'pending',
                processingProgress: 0
            });

            await video.save();

            // Add to processing queue
            processingQueue.add(video._id.toString());

            res.status(201).json({
                success: true,
                message: 'Video uploaded successfully. Processing started.',
                data: {
                    video: {
                        id: video._id,
                        title: video.title,
                        status: video.status,
                        processingProgress: video.processingProgress
                    }
                }
            });
        } catch (error) {
            console.error('Upload error:', error);

            // Clean up file on error
            if (req.file) {
                await deleteVideoFile(req.file.path);
            }

            res.status(500).json({
                success: false,
                message: 'Server error during upload'
            });
        }
    }
);

// @route   GET /api/videos
// @desc    Get all videos for current user
// @access  Private
router.get('/',
    authenticate,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
        query('classification').optional().isIn(['safe', 'flagged', 'pending']),
        query('sortBy').optional().isIn(['createdAt', 'title', 'size', 'duration']),
        query('sortOrder').optional().isIn(['asc', 'desc'])
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid query parameters',
                    errors: errors.array()
                });
            }

            const options = {
                page: req.query.page || 1,
                limit: req.query.limit || 20,
                status: req.query.status,
                classification: req.query.classification,
                sortBy: req.query.sortBy || 'createdAt',
                sortOrder: req.query.sortOrder || 'desc'
            };

            const result = await Video.getForUser(
                req.user._id,
                req.user.role,
                req.user.organization,
                options
            );

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Get videos error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    }
);

// @route   GET /api/videos/:id
// @desc    Get single video details
// @access  Private (Owner or shared)
router.get('/:id', authenticate, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id)
            .populate('owner', 'name email');

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
            data: { video }
        });
    } catch (error) {
        console.error('Get video error:', error);

        if (error.name === 'CastError') {
            return res.status(404).json({
                success: false,
                message: 'Video not found'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PATCH /api/videos/:id
// @desc    Update video metadata
// @access  Private (Owner or Admin)
router.patch('/:id',
    authenticate,
    requirePermission('video:update'),
    [
        body('title')
            .optional()
            .trim()
            .isLength({ min: 1, max: 200 })
            .withMessage('Title must be between 1 and 200 characters'),
        body('description')
            .optional()
            .trim()
            .isLength({ max: 2000 })
            .withMessage('Description cannot exceed 2000 characters'),
        body('tags')
            .optional()
            .isArray()
            .withMessage('Tags must be an array'),
        body('isPublic')
            .optional()
            .isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const video = await Video.findById(req.params.id);

            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found'
                });
            }

            // Check ownership (unless admin)
            if (req.user.role !== 'admin' &&
                video.owner.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Update fields
            const { title, description, tags, isPublic } = req.body;

            if (title !== undefined) video.title = title;
            if (description !== undefined) video.description = description;
            if (tags !== undefined) video.tags = tags;
            if (isPublic !== undefined) video.isPublic = isPublic;

            await video.save();

            res.json({
                success: true,
                message: 'Video updated',
                data: { video }
            });
        } catch (error) {
            console.error('Update video error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    }
);

// @route   DELETE /api/videos/:id
// @desc    Delete a video
// @access  Private (Owner or Admin)
router.delete('/:id',
    authenticate,
    requirePermission('video:delete'),
    async (req, res) => {
        try {
            const video = await Video.findById(req.params.id);

            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found'
                });
            }

            // Check ownership (unless admin)
            if (req.user.role !== 'admin' &&
                video.owner.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Delete files
            await deleteVideoFile(video.filePath);
            if (video.thumbnailPath) {
                await deleteThumbnail(video.thumbnailPath);
            }

            // Delete from database
            await Video.findByIdAndDelete(req.params.id);

            res.json({
                success: true,
                message: 'Video deleted successfully'
            });
        } catch (error) {
            console.error('Delete video error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    }
);

// @route   POST /api/videos/:id/share
// @desc    Share video with users
// @access  Private (Owner or Admin)
router.post('/:id/share',
    authenticate,
    [
        body('userIds')
            .isArray({ min: 1 })
            .withMessage('userIds must be a non-empty array')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: errors.array()
                });
            }

            const video = await Video.findById(req.params.id);

            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found'
                });
            }

            // Check ownership (unless admin)
            if (req.user.role !== 'admin' &&
                video.owner.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            const { userIds } = req.body;

            // Add users to accessibleBy (avoiding duplicates)
            const currentAccessible = video.accessibleBy.map(id => id.toString());
            const newAccessible = [...new Set([...currentAccessible, ...userIds])];
            video.accessibleBy = newAccessible;

            await video.save();

            res.json({
                success: true,
                message: 'Video shared successfully',
                data: {
                    sharedWith: newAccessible.length
                }
            });
        } catch (error) {
            console.error('Share video error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    }
);

// @route   POST /api/videos/:id/reprocess
// @desc    Re-process a video
// @access  Private (Owner or Admin)
router.post('/:id/reprocess',
    authenticate,
    async (req, res) => {
        try {
            const video = await Video.findById(req.params.id);

            if (!video) {
                return res.status(404).json({
                    success: false,
                    message: 'Video not found'
                });
            }

            // Check ownership (unless admin)
            if (req.user.role !== 'admin' &&
                video.owner.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied'
                });
            }

            // Reset processing status
            video.status = 'pending';
            video.processingProgress = 0;
            video.processingStage = 'queued';
            video.processingError = null;
            await video.save();

            // Add to processing queue
            processingQueue.add(video._id.toString());

            res.json({
                success: true,
                message: 'Video re-processing started'
            });
        } catch (error) {
            console.error('Reprocess video error:', error);
            res.status(500).json({
                success: false,
                message: 'Server error'
            });
        }
    }
);

export default router;
