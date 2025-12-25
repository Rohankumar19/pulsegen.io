import express from 'express';
import { body, query, validationResult } from 'express-validator';
import User from '../models/User.js';
import Video from '../models/Video.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = express.Router();

// All admin routes require admin role
router.use(authenticate);
router.use(requireRole('admin'));

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Admin only
router.get('/users', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('role').optional().isIn(['viewer', 'editor', 'admin']),
    query('search').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Invalid query parameters',
                errors: errors.array()
            });
        }

        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        const skip = (page - 1) * limit;

        let query = { organization: req.user.organization };

        if (req.query.role) {
            query.role = req.query.role;
        }

        if (req.query.search) {
            query.$or = [
                { name: { $regex: req.query.search, $options: 'i' } },
                { email: { $regex: req.query.search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-refreshToken')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query)
        ]);

        // Get video counts for each user
        const userIds = users.map(u => u._id);
        const videoCounts = await Video.aggregate([
            { $match: { owner: { $in: userIds } } },
            { $group: { _id: '$owner', count: { $sum: 1 } } }
        ]);

        const videoCountMap = {};
        videoCounts.forEach(vc => {
            videoCountMap[vc._id.toString()] = vc.count;
        });

        const usersWithCounts = users.map(user => ({
            ...user,
            videoCount: videoCountMap[user._id.toString()] || 0
        }));

        res.json({
            success: true,
            data: {
                users: usersWithCounts,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/users/:id
// @desc    Get single user details
// @access  Admin only
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-refreshToken');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's video stats
        const videoStats = await Video.aggregate([
            { $match: { owner: user._id } },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalSize: { $sum: '$size' },
                    safeVideos: {
                        $sum: { $cond: [{ $eq: ['$sensitivityResult.classification', 'safe'] }, 1, 0] }
                    },
                    flaggedVideos: {
                        $sum: { $cond: [{ $eq: ['$sensitivityResult.classification', 'flagged'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                user: user.toPublicJSON(),
                stats: videoStats[0] || {
                    totalVideos: 0,
                    totalSize: 0,
                    safeVideos: 0,
                    flaggedVideos: 0
                }
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   PATCH /api/admin/users/:id
// @desc    Update user (role, status)
// @access  Admin only
router.patch('/users/:id', [
    body('role').optional().isIn(['viewer', 'editor', 'admin']),
    body('isActive').optional().isBoolean(),
    body('name').optional().trim().isLength({ min: 2, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent admin from demoting themselves
        if (user._id.toString() === req.user._id.toString() &&
            req.body.role && req.body.role !== 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Cannot change your own role'
            });
        }

        // Prevent admin from deactivating themselves
        if (user._id.toString() === req.user._id.toString() &&
            req.body.isActive === false) {
            return res.status(400).json({
                success: false,
                message: 'Cannot deactivate your own account'
            });
        }

        const { role, isActive, name } = req.body;

        if (role !== undefined) user.role = role;
        if (isActive !== undefined) user.isActive = isActive;
        if (name !== undefined) user.name = name;

        await user.save();

        res.json({
            success: true,
            message: 'User updated',
            data: { user: user.toPublicJSON() }
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Admin only
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent admin from deleting themselves
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }

        // Delete user's videos (or keep them and reassign)
        // For now, we'll delete the videos too
        await Video.deleteMany({ owner: user._id });

        await User.findByIdAndDelete(req.params.id);

        res.json({
            success: true,
            message: 'User and their videos deleted'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/stats
// @desc    Get system statistics
// @access  Admin only
router.get('/stats', async (req, res) => {
    try {
        const organization = req.user.organization;

        // User stats
        const userStats = await User.aggregate([
            { $match: { organization } },
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalUsers = await User.countDocuments({ organization });
        const activeUsers = await User.countDocuments({ organization, isActive: true });

        // Video stats
        const videoStats = await Video.aggregate([
            { $match: { organization } },
            {
                $group: {
                    _id: null,
                    totalVideos: { $sum: 1 },
                    totalSize: { $sum: '$size' },
                    totalDuration: { $sum: '$duration' },
                    totalViews: { $sum: '$views' }
                }
            }
        ]);

        // Video status breakdown
        const videoStatusStats = await Video.aggregate([
            { $match: { organization } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Sensitivity breakdown
        const sensitivityStats = await Video.aggregate([
            { $match: { organization, status: 'completed' } },
            {
                $group: {
                    _id: '$sensitivityResult.classification',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Recent activity
        const recentVideos = await Video.find({ organization })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('owner', 'name')
            .select('title status createdAt owner');

        res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    active: activeUsers,
                    byRole: userStats.reduce((acc, curr) => {
                        acc[curr._id] = curr.count;
                        return acc;
                    }, {})
                },
                videos: videoStats[0] || {
                    totalVideos: 0,
                    totalSize: 0,
                    totalDuration: 0,
                    totalViews: 0
                },
                videosByStatus: videoStatusStats.reduce((acc, curr) => {
                    acc[curr._id] = curr.count;
                    return acc;
                }, {}),
                videosBySensitivity: sensitivityStats.reduce((acc, curr) => {
                    acc[curr._id || 'unknown'] = curr.count;
                    return acc;
                }, {}),
                recentVideos
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// @route   GET /api/admin/videos
// @desc    Get all videos (admin view)
// @access  Admin only
router.get('/videos', [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('classification').optional().isIn(['safe', 'flagged', 'pending'])
], async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 20;
        const skip = (page - 1) * limit;

        let query = { organization: req.user.organization };

        if (req.query.status) {
            query.status = req.query.status;
        }

        if (req.query.classification) {
            query['sensitivityResult.classification'] = req.query.classification;
        }

        const [videos, total] = await Promise.all([
            Video.find(query)
                .populate('owner', 'name email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Video.countDocuments(query)
        ]);

        res.json({
            success: true,
            data: {
                videos,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get admin videos error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

export default router;
