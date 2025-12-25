import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVideos } from '../context/VideoContext';
import { useSocket } from '../context/SocketContext';
import VideoCard from '../components/videos/VideoCard';
import './Dashboard.css';

export default function Dashboard() {
    const { user } = useAuth();
    const { videos, loading, fetchVideos, pagination } = useVideos();
    const { connected } = useSocket();
    const [stats, setStats] = useState({
        total: 0,
        processing: 0,
        completed: 0,
        safe: 0,
        flagged: 0
    });

    useEffect(() => {
        fetchVideos(1);
    }, [fetchVideos]);

    // Calculate stats from videos
    useEffect(() => {
        if (videos.length > 0) {
            setStats({
                total: pagination.total,
                processing: videos.filter(v => v.status === 'processing' || v.status === 'pending').length,
                completed: videos.filter(v => v.status === 'completed').length,
                safe: videos.filter(v => v.sensitivityResult?.classification === 'safe').length,
                flagged: videos.filter(v => v.sensitivityResult?.classification === 'flagged').length
            });
        }
    }, [videos, pagination.total]);

    const statCards = [
        { label: 'Total Videos', value: stats.total, icon: '📹', color: 'primary' },
        { label: 'Processing', value: stats.processing, icon: '⚡', color: 'info' },
        { label: 'Completed', value: stats.completed, icon: '✅', color: 'success' },
        { label: 'Flagged', value: stats.flagged, icon: '🚩', color: 'error' }
    ];

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <div>
                    <h1 className="page-title">
                        Welcome back, {user?.name?.split(' ')[0] || 'User'}! 👋
                    </h1>
                    <p className="page-subtitle">
                        Here's an overview of your video processing activity
                    </p>
                </div>
                <div className="connection-status">
                    <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
                    {connected ? 'Real-time updates active' : 'Connecting...'}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                {statCards.map((stat, index) => (
                    <div key={index} className={`stat-card stat-${stat.color}`}>
                        <div className="stat-icon">{stat.icon}</div>
                        <div className="stat-content">
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-label">{stat.label}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Videos */}
            <div className="dashboard-section">
                <div className="section-header">
                    <h2 className="section-title">Recent Videos</h2>
                    <a href="/videos" className="btn btn-secondary btn-sm">
                        View All →
                    </a>
                </div>

                {loading ? (
                    <div className="videos-loading">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="video-card-skeleton">
                                <div className="skeleton skeleton-thumbnail"></div>
                                <div className="skeleton-content">
                                    <div className="skeleton skeleton-title"></div>
                                    <div className="skeleton skeleton-text"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : videos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🎬</div>
                        <h3>No videos yet</h3>
                        <p>Upload your first video to get started!</p>
                        <a href="/upload" className="btn btn-primary">
                            Upload Video
                        </a>
                    </div>
                ) : (
                    <div className="videos-grid">
                        {videos.slice(0, 6).map(video => (
                            <VideoCard key={video._id} video={video} />
                        ))}
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div className="dashboard-section">
                <h2 className="section-title">Quick Actions</h2>
                <div className="quick-actions">
                    <a href="/upload" className="action-card">
                        <div className="action-icon">📤</div>
                        <div className="action-content">
                            <h3>Upload Video</h3>
                            <p>Add a new video for processing</p>
                        </div>
                    </a>
                    <a href="/videos" className="action-card">
                        <div className="action-icon">📚</div>
                        <div className="action-content">
                            <h3>Video Library</h3>
                            <p>Browse all your videos</p>
                        </div>
                    </a>
                    <a href="/videos?status=processing" className="action-card">
                        <div className="action-icon">⏳</div>
                        <div className="action-content">
                            <h3>Processing Queue</h3>
                            <p>View videos being processed</p>
                        </div>
                    </a>
                </div>
            </div>
        </div>
    );
}
