import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
}

// Allowed video formats
const ALLOWED_FORMATS = process.env.ALLOWED_FORMATS?.split(',') || ['mp4', 'mkv', 'avi', 'mov', 'webm'];
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 500 * 1024 * 1024; // 500MB default

// Storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Create user-specific folder for multi-tenant isolation
        const userFolder = path.join(uploadsDir, req.user._id.toString());

        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }

        cb(null, userFolder);
    },
    filename: (req, file, cb) => {
        // Generate unique filename with original extension
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

// File filter for video files
const fileFilter = (req, file, cb) => {
    // Check mimetype
    const validMimetypes = [
        'video/mp4',
        'video/x-matroska',
        'video/avi',
        'video/x-msvideo',
        'video/quicktime',
        'video/webm'
    ];

    if (!validMimetypes.includes(file.mimetype)) {
        return cb(new Error('Invalid file type. Only video files are allowed.'), false);
    }

    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');

    if (!ALLOWED_FORMATS.includes(ext)) {
        return cb(new Error(`Invalid file format. Allowed formats: ${ALLOWED_FORMATS.join(', ')}`), false);
    }

    cb(null, true);
};

// Create multer upload instance
export const uploadVideo = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1 // Only allow single file upload
    }
}).single('video');

// Middleware wrapper with error handling
export const handleVideoUpload = (req, res, next) => {
    uploadVideo(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            // Multer error
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({
                    success: false,
                    message: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB`
                });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
                return res.status(400).json({
                    success: false,
                    message: 'Only one file can be uploaded at a time'
                });
            }
            return res.status(400).json({
                success: false,
                message: err.message
            });
        } else if (err) {
            // Custom error
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        // Check if file was provided
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No video file provided'
            });
        }

        next();
    });
};

// Delete video file utility
export const deleteVideoFile = async (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting file:', error);
        return false;
    }
};

// Delete thumbnail utility
export const deleteThumbnail = async (thumbnailPath) => {
    try {
        if (thumbnailPath && fs.existsSync(thumbnailPath)) {
            await fs.promises.unlink(thumbnailPath);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting thumbnail:', error);
        return false;
    }
};

export default { uploadVideo, handleVideoUpload, deleteVideoFile, deleteThumbnail };
