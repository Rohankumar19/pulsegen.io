import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVideos } from '../../context/VideoContext';
import { useSocket } from '../../context/SocketContext';
import './VideoCard.css';

export default function VideoCard({ video }) {
    const [showMenu, setShowMenu] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const { deleteVideo } = useVideos();
    const { subscribeToVideo } = useSocket();

    // Subscribe to updates if processing
    if (video.status === 'pending' || video.status === 'processing') {
        subscribeToVideo(video._id);
    }

    const handleDelete = async () => {
        if (confirm('Are you sure you want to delete this video?')) {
            setDeleting(true);
            await deleteVideo(video._id);
        }
        setShowMenu(false);
    };

    const getStatusBadge = () => {
        switch (video.status) {
            case 'pending':
                return <span className="badge badge-pending">⏳ Pending</span>;
            case 'processing':
                return <span className="badge badge-processing">⚡ Processing</span>;
            case 'completed':
                const classification = video.sensitivityResult?.classification;
                if (classification === 'safe') {
                    return <span className="badge badge-safe">✓ Safe</span>;
                } else if (classification === 'flagged') {
                    return <span className="badge badge-flagged">⚠ Flagged</span>;
                }
                return <span className="badge badge-safe">✓ Complete</span>;
            case 'failed':
                return <span className="badge badge-flagged">✕ Failed</span>;
            default:
                return null;
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const isProcessing = video.status === 'pending' || video.status === 'processing';

    return (
        <div className={`video-card ${deleting ? 'deleting' : ''}`}>
            <Link
                to={`/watch/${video._id}`}
                className="video-card-thumbnail"
            >
                {video.thumbnailPath ? (
                    <img
                        src={`${import.meta.env.VITE_API_URL}/stream/${video._id}/thumbnail`}
                        alt={video.title}
                        loading="lazy"
                    />
                ) : (
                    <div className="thumbnail-placeholder">
                        <span>🎬</span>
                    </div>
                )}

                {isProcessing && (
                    <div className="processing-overlay-card">
                        <div className="progress-ring-small">
                            <svg width="48" height="48" viewBox="0 0 48 48">
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    fill="none"
                                    stroke="rgba(255,255,255,0.2)"
                                    strokeWidth="4"
                                />
                                <circle
                                    cx="24"
                                    cy="24"
                                    r="20"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="4"
                                    strokeLinecap="round"
                                    strokeDasharray={126}
                                    strokeDashoffset={126 - (126 * (video.processingProgress || 0)) / 100}
                                    style={{ transform: 'rotate(-90deg)', transformOrigin: '24px 24px' }}
                                />
                            </svg>
                            <span className="progress-ring-text">{video.processingProgress || 0}%</span>
                        </div>
                    </div>
                )}

                {video.duration > 0 && !isProcessing && (
                    <span className="video-duration">{video.formattedDuration}</span>
                )}
            </Link>

            <div className="video-card-content">
                <Link to={`/watch/${video._id}`} className="video-card-title">
                    {video.title}
                </Link>

                <div className="video-card-meta">
                    <span className="video-size">{video.formattedSize}</span>
                    <span className="video-date">{formatDate(video.createdAt)}</span>
                </div>

                <div className="video-card-footer">
                    {getStatusBadge()}

                    <div className="video-card-actions">
                        <button
                            className="btn-icon-small"
                            onClick={() => setShowMenu(!showMenu)}
                            aria-label="More options"
                        >
                            ⋮
                        </button>

                        {showMenu && (
                            <>
                                <div
                                    className="menu-overlay"
                                    onClick={() => setShowMenu(false)}
                                />
                                <div className="video-menu">
                                    <Link
                                        to={`/watch/${video._id}`}
                                        className="menu-item"
                                        onClick={() => setShowMenu(false)}
                                    >
                                        ▶️ Watch
                                    </Link>
                                    <button
                                        className="menu-item"
                                        onClick={handleDelete}
                                    >
                                        🗑️ Delete
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
