import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { emitVideoProgress } from '../config/socket.js';
import Video from '../models/Video.js';

// Check if FFmpeg is available
const checkFFmpeg = () => {
    return new Promise((resolve) => {
        const ffmpeg = spawn('ffmpeg', ['-version']);
        ffmpeg.on('error', () => resolve(false));
        ffmpeg.on('close', (code) => resolve(code === 0));
    });
};

// Extract video metadata using FFprobe
export const extractMetadata = async (filePath) => {
    return new Promise((resolve, reject) => {
        const ffprobe = spawn('ffprobe', [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            filePath
        ]);

        let output = '';
        let errorOutput = '';

        ffprobe.stdout.on('data', (data) => {
            output += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffprobe.on('close', (code) => {
            if (code !== 0) {
                // Return default metadata if FFprobe fails
                console.warn('FFprobe failed, using default metadata');
                resolve({
                    duration: 0,
                    width: 0,
                    height: 0,
                    codec: 'unknown',
                    bitrate: 0
                });
                return;
            }

            try {
                const metadata = JSON.parse(output);
                const videoStream = metadata.streams?.find(s => s.codec_type === 'video');

                resolve({
                    duration: parseFloat(metadata.format?.duration) || 0,
                    width: videoStream?.width || 0,
                    height: videoStream?.height || 0,
                    codec: videoStream?.codec_name || 'unknown',
                    bitrate: parseInt(metadata.format?.bit_rate) || 0
                });
            } catch (error) {
                console.warn('Failed to parse FFprobe output:', error);
                resolve({
                    duration: 0,
                    width: 0,
                    height: 0,
                    codec: 'unknown',
                    bitrate: 0
                });
            }
        });

        ffprobe.on('error', (error) => {
            console.warn('FFprobe error:', error);
            resolve({
                duration: 0,
                width: 0,
                height: 0,
                codec: 'unknown',
                bitrate: 0
            });
        });
    });
};

// Generate thumbnail from video
export const generateThumbnail = async (videoPath, outputPath, timestamp = '00:00:01') => {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn('ffmpeg', [
            '-i', videoPath,
            '-ss', timestamp,
            '-vframes', '1',
            '-vf', 'scale=320:-1',
            '-y',
            outputPath
        ]);

        let errorOutput = '';

        ffmpeg.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                console.warn('Thumbnail generation failed:', errorOutput);
                resolve(null); // Don't fail if thumbnail fails
                return;
            }
            resolve(outputPath);
        });

        ffmpeg.on('error', (error) => {
            console.warn('FFmpeg thumbnail error:', error);
            resolve(null);
        });
    });
};

// Main video processing function
export const processVideo = async (videoId) => {
    try {
        const video = await Video.findById(videoId);

        if (!video) {
            throw new Error('Video not found');
        }

        // Update status to processing
        video.status = 'processing';
        video.processingStage = 'extracting_metadata';
        video.processingProgress = 10;
        await video.save();

        emitVideoProgress(videoId, {
            status: 'processing',
            stage: 'extracting_metadata',
            progress: 10,
            message: 'Extracting video metadata...'
        });

        // Step 1: Extract metadata (10-30%)
        const metadata = await extractMetadata(video.filePath);

        video.duration = metadata.duration;
        video.resolution = {
            width: metadata.width,
            height: metadata.height
        };
        video.metadata = {
            ...video.metadata,
            codec: metadata.codec,
            bitrate: metadata.bitrate
        };
        video.processingProgress = 30;
        video.processingStage = 'generating_thumbnail';
        await video.save();

        emitVideoProgress(videoId, {
            status: 'processing',
            stage: 'generating_thumbnail',
            progress: 30,
            message: 'Generating thumbnail...'
        });

        // Step 2: Generate thumbnail (30-50%)
        const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
        const thumbnailPath = path.join(thumbnailsDir, `${videoId}.jpg`);

        const thumbnail = await generateThumbnail(video.filePath, thumbnailPath);

        if (thumbnail) {
            video.thumbnailPath = thumbnailPath;
        }

        video.processingProgress = 50;
        video.processingStage = 'analyzing_content';
        await video.save();

        emitVideoProgress(videoId, {
            status: 'processing',
            stage: 'analyzing_content',
            progress: 50,
            message: 'Analyzing content for sensitivity...'
        });

        // Step 3: Sensitivity analysis (50-90%)
        // Import sensitivity analyzer dynamically to avoid circular dependency
        const { analyzeSensitivity } = await import('./sensitivityAnalyzer.js');
        const sensitivityResult = await analyzeSensitivity(video.filePath, videoId);

        video.sensitivityResult = sensitivityResult;
        video.processingProgress = 90;
        video.processingStage = 'finalizing';
        await video.save();

        emitVideoProgress(videoId, {
            status: 'processing',
            stage: 'finalizing',
            progress: 90,
            message: 'Finalizing...'
        });

        // Step 4: Finalize (90-100%)
        video.status = 'completed';
        video.processingProgress = 100;
        video.processingStage = 'done';
        await video.save();

        emitVideoProgress(videoId, {
            status: 'completed',
            stage: 'done',
            progress: 100,
            message: 'Processing complete!',
            sensitivityResult: sensitivityResult
        });

        return {
            success: true,
            video: video
        };

    } catch (error) {
        console.error('Video processing error:', error);

        // Update video with error status
        try {
            await Video.findByIdAndUpdate(videoId, {
                status: 'failed',
                processingError: error.message,
                processingStage: 'error'
            });

            emitVideoProgress(videoId, {
                status: 'failed',
                stage: 'error',
                progress: 0,
                message: error.message,
                error: true
            });
        } catch (updateError) {
            console.error('Failed to update video error status:', updateError);
        }

        return {
            success: false,
            error: error.message
        };
    }
};

// Queue for video processing (simple in-memory queue)
class ProcessingQueue {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.concurrency = 2; // Process 2 videos at a time
        this.activeJobs = 0;
    }

    add(videoId) {
        this.queue.push(videoId);
        this.process();
    }

    async process() {
        if (this.activeJobs >= this.concurrency || this.queue.length === 0) {
            return;
        }

        const videoId = this.queue.shift();
        this.activeJobs++;

        try {
            await processVideo(videoId);
        } catch (error) {
            console.error('Queue processing error:', error);
        } finally {
            this.activeJobs--;
            this.process(); // Process next in queue
        }
    }
}

export const processingQueue = new ProcessingQueue();

export default {
    extractMetadata,
    generateThumbnail,
    processVideo,
    processingQueue
};
