import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useVideos } from '../context/VideoContext';
import { useSocket } from '../context/SocketContext';
import './Upload.css';

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/avi'];
const MAX_SIZE = 500 * 1024 * 1024; // 500MB

export default function Upload() {
    const [file, setFile] = useState(null);
    const [metadata, setMetadata] = useState({
        title: '',
        description: '',
        tags: ''
    });
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingStage, setProcessingStage] = useState('');
    const [error, setError] = useState('');
    const [uploadedVideoId, setUploadedVideoId] = useState(null);

    const { uploadVideo } = useVideos();
    const { subscribeToVideo, onVideoProgress, onVideoComplete, onVideoError } = useSocket();
    const navigate = useNavigate();

    const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
        setError('');

        if (rejectedFiles.length > 0) {
            const rejection = rejectedFiles[0];
            if (rejection.errors[0]?.code === 'file-too-large') {
                setError('File is too large. Maximum size is 500MB.');
            } else if (rejection.errors[0]?.code === 'file-invalid-type') {
                setError('Invalid file type. Please upload a video file.');
            } else {
                setError('Invalid file. Please try again.');
            }
            return;
        }

        if (acceptedFiles.length > 0) {
            const selectedFile = acceptedFiles[0];
            setFile(selectedFile);

            // Auto-fill title from filename
            if (!metadata.title) {
                const title = selectedFile.name.replace(/\.[^/.]+$/, '');
                setMetadata(prev => ({ ...prev, title }));
            }
        }
    }, [metadata.title]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/*': ['.mp4', '.webm', '.mov', '.mkv', '.avi']
        },
        maxSize: MAX_SIZE,
        multiple: false
    });

    const handleMetadataChange = (e) => {
        setMetadata(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            setError('Please select a video file');
            return;
        }

        setError('');
        setUploading(true);
        setUploadProgress(0);

        const result = await uploadVideo(
            file,
            {
                title: metadata.title || file.name,
                description: metadata.description,
                tags: metadata.tags.split(',').map(t => t.trim()).filter(t => t)
            },
            (progress) => setUploadProgress(progress)
        );

        if (result.success) {
            setUploadedVideoId(result.video.id);
            subscribeToVideo(result.video.id);
            setProcessingStage('queued');

            // Listen for progress updates
            const unsubProgress = onVideoProgress((data) => {
                if (data.videoId === result.video.id) {
                    setProcessingProgress(data.progress);
                    setProcessingStage(data.stage);
                }
            });

            const unsubComplete = onVideoComplete((data) => {
                if (data.videoId === result.video.id) {
                    setProcessingProgress(100);
                    setProcessingStage('done');
                    setTimeout(() => {
                        navigate('/videos');
                    }, 1500);
                }
            });

            const unsubError = onVideoError((data) => {
                if (data.videoId === result.video.id) {
                    setError(`Processing failed: ${data.error}`);
                    setUploading(false);
                }
            });

            // Cleanup on unmount
            return () => {
                unsubProgress();
                unsubComplete();
                unsubError();
            };
        } else {
            setError(result.error);
            setUploading(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getStageLabel = (stage) => {
        const stages = {
            queued: 'Queued',
            extracting_metadata: 'Extracting metadata',
            generating_thumbnail: 'Generating thumbnail',
            analyzing_content: 'Analyzing content',
            finalizing: 'Finalizing',
            done: 'Complete!'
        };
        return stages[stage] || stage;
    };

    const removeFile = () => {
        setFile(null);
        setMetadata(prev => ({ ...prev, title: '' }));
    };

    return (
        <div className="upload-page">
            <div className="page-header">
                <h1 className="page-title">Upload Video</h1>
                <p className="page-subtitle">
                    Upload a video for sensitivity analysis and processing
                </p>
            </div>

            {error && (
                <div className="upload-error">
                    <span>⚠️</span>
                    {error}
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            <div className="upload-container">
                {!file ? (
                    <div
                        {...getRootProps()}
                        className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}
                    >
                        <input {...getInputProps()} />
                        <div className="dropzone-content">
                            <div className="dropzone-icon">📁</div>
                            <h3>Drop your video here</h3>
                            <p>or click to browse</p>
                            <div className="dropzone-info">
                                <span>MP4, WebM, MOV, MKV, AVI</span>
                                <span>•</span>
                                <span>Max 500MB</span>
                            </div>
                        </div>
                    </div>
                ) : uploading ? (
                    <div className="upload-progress-container">
                        <div className="progress-ring-container">
                            <svg className="progress-ring" width="160" height="160">
                                <defs>
                                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="var(--primary)" />
                                        <stop offset="100%" stopColor="var(--secondary)" />
                                    </linearGradient>
                                </defs>
                                <circle
                                    className="progress-ring-bg"
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    fill="none"
                                    stroke="var(--bg-tertiary)"
                                    strokeWidth="8"
                                />
                                <circle
                                    className="progress-ring-fill"
                                    cx="80"
                                    cy="80"
                                    r="70"
                                    fill="none"
                                    stroke="url(#gradient)"
                                    strokeWidth="8"
                                    strokeLinecap="round"
                                    strokeDasharray={440}
                                    strokeDashoffset={440 - (440 * (uploadProgress < 100 ? uploadProgress : processingProgress)) / 100}
                                    style={{ transform: 'rotate(-90deg)', transformOrigin: '80px 80px' }}
                                />
                            </svg>
                            <div className="progress-text">
                                <span className="progress-value">
                                    {uploadProgress < 100 ? uploadProgress : processingProgress}%
                                </span>
                                <span className="progress-label">
                                    {uploadProgress < 100 ? 'Uploading' : getStageLabel(processingStage)}
                                </span>
                            </div>
                        </div>

                        <div className="upload-file-info">
                            <h3>{metadata.title || file.name}</h3>
                            <p>{formatFileSize(file.size)}</p>
                        </div>

                        {processingStage === 'done' && (
                            <div className="upload-success">
                                <span>✅</span>
                                Processing complete! Redirecting...
                            </div>
                        )}
                    </div>
                ) : (
                    <form className="upload-form" onSubmit={handleSubmit}>
                        <div className="selected-file">
                            <div className="file-preview">
                                <span className="file-icon">🎬</span>
                                <div className="file-info">
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={removeFile}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="title">Title</label>
                            <input
                                type="text"
                                id="title"
                                name="title"
                                className="input"
                                placeholder="Video title"
                                value={metadata.title}
                                onChange={handleMetadataChange}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="description">Description</label>
                            <textarea
                                id="description"
                                name="description"
                                className="input textarea"
                                placeholder="Add a description..."
                                value={metadata.description}
                                onChange={handleMetadataChange}
                                rows={4}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label" htmlFor="tags">Tags</label>
                            <input
                                type="text"
                                id="tags"
                                name="tags"
                                className="input"
                                placeholder="Separate tags with commas"
                                value={metadata.tags}
                                onChange={handleMetadataChange}
                            />
                        </div>

                        <div className="form-actions">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={removeFile}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn btn-primary btn-lg">
                                <span>🚀</span>
                                Upload & Process
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
