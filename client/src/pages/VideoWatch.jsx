import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videoService from '../services/videoService';
import { useSocket } from '../context/SocketContext';
import './VideoWatch.css';

export default function VideoWatch() {
    const { id } = useParams();
    const navigate = useNavigate();
    const videoRef = useRef(null);

    const [video, setVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [showControls, setShowControls] = useState(true);

    const { subscribeToVideo, onVideoProgress, onVideoComplete } = useSocket();

    useEffect(() => {
        const fetchVideo = async () => {
            try {
                const response = await videoService.getVideo(id);
                if (response.success) {
                    setVideo(response.data.video);

                    // Subscribe to updates if still processing
                    if (response.data.video.status !== 'completed') {
                        subscribeToVideo(id);
                    }
                }
            } catch (err) {
                setError(err.response?.data?.message || 'Failed to load video');
            } finally {
                setLoading(false);
            }
        };

        fetchVideo();
    }, [id, subscribeToVideo]);

    // Listen for processing updates
    useEffect(() => {
        const unsubProgress = onVideoProgress((data) => {
            if (data.videoId === id) {
                setVideo(prev => ({
                    ...prev,
                    processingProgress: data.progress,
                    processingStage: data.stage,
                    status: data.status
                }));
            }
        });

        const unsubComplete = onVideoComplete((data) => {
            if (data.videoId === id) {
                setVideo(prev => ({
                    ...prev,
                    status: 'completed',
                    processingProgress: 100,
                    sensitivityResult: data.sensitivityResult
                }));
            }
        });

        return () => {
            unsubProgress();
            unsubComplete();
        };
    }, [id, onVideoProgress, onVideoComplete]);

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const handleVolumeChange = (e) => {
        const vol = parseFloat(e.target.value);
        setVolume(vol);
        if (videoRef.current) {
            videoRef.current.volume = vol;
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleFullscreen = () => {
        const container = document.querySelector('.video-player-container');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            container?.requestFullscreen();
        }
    };

    if (loading) {
        return (
            <div className="video-watch loading">
                <div className="spinner-large"></div>
                <p>Loading video...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="video-watch error">
                <div className="error-icon">⚠️</div>
                <h2>Error</h2>
                <p>{error}</p>
                <button className="btn btn-secondary" onClick={() => navigate('/videos')}>
                    Back to Library
                </button>
            </div>
        );
    }

    if (!video) {
        return null;
    }

    const isProcessing = video.status === 'pending' || video.status === 'processing';
    const isFailed = video.status === 'failed';

    return (
        <div className="video-watch">
            <div className="video-watch-header">
                <button
                    className="btn btn-ghost"
                    onClick={() => navigate('/videos')}
                >
                    ← Back
                </button>
            </div>

            {isProcessing ? (
                <div className="processing-overlay">
                    <div className="processing-content">
                        <div className="processing-spinner"></div>
                        <h2>Processing Video</h2>
                        <div className="progress">
                            <div
                                className="progress-bar"
                                style={{ width: `${video.processingProgress || 0}%` }}
                            ></div>
                        </div>
                        <p>{video.processingProgress || 0}% - {video.processingStage || 'Queued'}</p>
                    </div>
                </div>
            ) : isFailed ? (
                <div className="failed-overlay">
                    <div className="failed-content">
                        <div className="failed-icon">❌</div>
                        <h2>Processing Failed</h2>
                        <p>{video.processingError || 'An error occurred during processing'}</p>
                        <button className="btn btn-primary">
                            Retry Processing
                        </button>
                    </div>
                </div>
            ) : (
                <div
                    className="video-player-container"
                    onMouseEnter={() => setShowControls(true)}
                    onMouseLeave={() => setShowControls(isPlaying ? false : true)}
                >
                    <video
                        ref={videoRef}
                        className="video-player"
                        src={`${import.meta.env.VITE_API_URL}/stream/${id}`}
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onClick={handlePlayPause}
                    />

                    <div className={`video-controls ${showControls ? 'visible' : ''}`}>
                        <div className="progress-container">
                            <input
                                type="range"
                                className="progress-slider"
                                min={0}
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                            />
                        </div>

                        <div className="controls-row">
                            <div className="controls-left">
                                <button className="control-btn" onClick={handlePlayPause}>
                                    {isPlaying ? '⏸️' : '▶️'}
                                </button>

                                <div className="volume-control">
                                    <button className="control-btn">
                                        {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                                    </button>
                                    <input
                                        type="range"
                                        className="volume-slider"
                                        min={0}
                                        max={1}
                                        step={0.1}
                                        value={volume}
                                        onChange={handleVolumeChange}
                                    />
                                </div>

                                <span className="time-display">
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </span>
                            </div>

                            <div className="controls-right">
                                <button className="control-btn" onClick={toggleFullscreen}>
                                    ⛶
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Info */}
            <div className="video-info">
                <div className="video-info-header">
                    <h1 className="video-title">{video.title}</h1>
                    <div className={`badge badge-${video.sensitivityResult?.classification || 'pending'}`}>
                        {video.sensitivityResult?.classification === 'safe' && '✓ '}
                        {video.sensitivityResult?.classification === 'flagged' && '⚠ '}
                        {video.sensitivityResult?.classification || 'Pending'}
                    </div>
                </div>

                <div className="video-meta">
                    <span>📹 {video.formattedSize}</span>
                    <span>•</span>
                    <span>⏱️ {video.formattedDuration}</span>
                    <span>•</span>
                    <span>👁️ {video.views || 0} views</span>
                    <span>•</span>
                    <span>📅 {new Date(video.createdAt).toLocaleDateString()}</span>
                </div>

                {video.description && (
                    <p className="video-description">{video.description}</p>
                )}

                {video.tags?.length > 0 && (
                    <div className="video-tags">
                        {video.tags.map((tag, index) => (
                            <span key={index} className="tag">{tag}</span>
                        ))}
                    </div>
                )}

                {video.sensitivityResult?.classification === 'flagged' && (
                    <div className="sensitivity-warning">
                        <h3>⚠️ Content Flags</h3>
                        <p>This video has been flagged for the following reasons:</p>
                        <ul>
                            {video.sensitivityResult.flags?.map((flag, index) => (
                                <li key={index}>{flag.replace(/_/g, ' ')}</li>
                            ))}
                        </ul>
                        <p className="confidence">
                            Confidence: {video.sensitivityResult.confidence}%
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
