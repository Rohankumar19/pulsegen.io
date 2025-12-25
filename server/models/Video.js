import mongoose from 'mongoose';

const sensitivityResultSchema = new mongoose.Schema({
    classification: {
        type: String,
        enum: ['safe', 'flagged', 'pending'],
        default: 'pending'
    },
    confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    flags: [{
        type: String
    }],
    analyzedAt: {
        type: Date,
        default: null
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const videoSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Video title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
        default: ''
    },
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    mimetype: {
        type: String,
        required: true
    },
    size: {
        type: Number,
        required: true
    },
    duration: {
        type: Number, // Duration in seconds
        default: 0
    },
    resolution: {
        width: { type: Number, default: 0 },
        height: { type: Number, default: 0 }
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    organization: {
        type: String,
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
        index: true
    },
    processingProgress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    processingStage: {
        type: String,
        enum: ['queued', 'extracting_metadata', 'generating_thumbnail', 'analyzing_content', 'finalizing', 'done', 'error'],
        default: 'queued'
    },
    processingError: {
        type: String,
        default: null
    },
    sensitivityResult: {
        type: sensitivityResultSchema,
        default: () => ({})
    },
    thumbnailPath: {
        type: String,
        default: null
    },
    filePath: {
        type: String,
        required: true
    },
    accessibleBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    tags: [{
        type: String,
        trim: true
    }],
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    views: {
        type: Number,
        default: 0
    },
    isPublic: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
videoSchema.index({ owner: 1, status: 1 });
videoSchema.index({ organization: 1, status: 1 });
videoSchema.index({ 'sensitivityResult.classification': 1 });
videoSchema.index({ createdAt: -1 });
videoSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtual for formatted file size
videoSchema.virtual('formattedSize').get(function () {
    const bytes = this.size;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Virtual for formatted duration
videoSchema.virtual('formattedDuration').get(function () {
    const seconds = this.duration;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
});

// Ensure virtuals are included in JSON
videoSchema.set('toJSON', { virtuals: true });
videoSchema.set('toObject', { virtuals: true });

// Method to check if user can access this video
videoSchema.methods.canAccess = function (userId, userRole) {
    // Admin can access all
    if (userRole === 'admin') return true;

    // Owner can access
    if (this.owner.toString() === userId.toString()) return true;

    // Check if user is in accessibleBy list
    if (this.accessibleBy.some(id => id.toString() === userId.toString())) return true;

    // Public videos are accessible to all
    if (this.isPublic) return true;

    return false;
};

// Static method to get videos for a user
videoSchema.statics.getForUser = async function (userId, userRole, organization, options = {}) {
    const {
        status,
        classification,
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
    } = options;

    let query = {};

    if (userRole === 'admin') {
        // Admin sees all videos in their organization
        query.organization = organization;
    } else {
        // Others see only their videos or shared videos
        query.$or = [
            { owner: userId },
            { accessibleBy: userId },
            { isPublic: true, organization: organization }
        ];
    }

    if (status) {
        query.status = status;
    }

    if (classification) {
        query['sensitivityResult.classification'] = classification;
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [videos, total] = await Promise.all([
        this.find(query)
            .populate('owner', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        this.countDocuments(query)
    ]);

    return {
        videos,
        pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
        }
    };
};

const Video = mongoose.model('Video', videoSchema);

export default Video;
