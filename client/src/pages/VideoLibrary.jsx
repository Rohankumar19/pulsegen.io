import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useVideos } from '../context/VideoContext';
import VideoCard from '../components/videos/VideoCard';
import './VideoLibrary.css';

export default function VideoLibrary() {
    const { videos, loading, fetchVideos, pagination, filters, updateFilters, clearFilters } = useVideos();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        // Apply URL search params as filters
        const status = searchParams.get('status');
        const classification = searchParams.get('classification');

        if (status || classification) {
            updateFilters({
                status: status || null,
                classification: classification || null
            });
        }

        fetchVideos(1);
    }, [searchParams]);

    const handleFilterChange = (key, value) => {
        updateFilters({ [key]: value || null });

        // Update URL
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        setSearchParams(params);

        fetchVideos(1);
    };

    const handleClearFilters = () => {
        clearFilters();
        setSearchParams({});
        setSearchTerm('');
        fetchVideos(1);
    };

    const handlePageChange = (page) => {
        fetchVideos(page);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const filteredVideos = searchTerm
        ? videos.filter(v =>
            v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            v.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : videos;

    const hasActiveFilters = filters.status || filters.classification || searchTerm;

    return (
        <div className="video-library">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Video Library</h1>
                    <p className="page-subtitle">
                        {pagination.total} videos in your library
                    </p>
                </div>
                <a href="/upload" className="btn btn-primary">
                    <span>📤</span> Upload Video
                </a>
            </div>

            {/* Filters Bar */}
            <div className="filters-bar">
                <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="input search-input"
                        placeholder="Search videos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="filter-group">
                    <select
                        className="input filter-select"
                        value={filters.status || ''}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="processing">Processing</option>
                        <option value="completed">Completed</option>
                        <option value="failed">Failed</option>
                    </select>

                    <select
                        className="input filter-select"
                        value={filters.classification || ''}
                        onChange={(e) => handleFilterChange('classification', e.target.value)}
                    >
                        <option value="">All Classifications</option>
                        <option value="safe">Safe</option>
                        <option value="flagged">Flagged</option>
                        <option value="pending">Pending</option>
                    </select>

                    <select
                        className="input filter-select"
                        value={`${filters.sortBy}-${filters.sortOrder}`}
                        onChange={(e) => {
                            const [sortBy, sortOrder] = e.target.value.split('-');
                            updateFilters({ sortBy, sortOrder });
                            fetchVideos(1);
                        }}
                    >
                        <option value="createdAt-desc">Newest First</option>
                        <option value="createdAt-asc">Oldest First</option>
                        <option value="title-asc">Title A-Z</option>
                        <option value="title-desc">Title Z-A</option>
                        <option value="size-desc">Largest First</option>
                        <option value="size-asc">Smallest First</option>
                    </select>

                    {hasActiveFilters && (
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={handleClearFilters}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Videos Grid */}
            {loading ? (
                <div className="videos-grid">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="video-card-skeleton">
                            <div className="skeleton skeleton-thumbnail"></div>
                            <div className="skeleton-content">
                                <div className="skeleton skeleton-title"></div>
                                <div className="skeleton skeleton-text"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : filteredVideos.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">📹</div>
                    <h3>No videos found</h3>
                    <p>
                        {hasActiveFilters
                            ? 'Try adjusting your filters'
                            : 'Upload your first video to get started'}
                    </p>
                    {hasActiveFilters ? (
                        <button
                            className="btn btn-secondary"
                            onClick={handleClearFilters}
                        >
                            Clear Filters
                        </button>
                    ) : (
                        <a href="/upload" className="btn btn-primary">
                            Upload Video
                        </a>
                    )}
                </div>
            ) : (
                <div className="videos-grid">
                    {filteredVideos.map(video => (
                        <VideoCard key={video._id} video={video} />
                    ))}
                </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="pagination">
                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={pagination.page === 1}
                        onClick={() => handlePageChange(pagination.page - 1)}
                    >
                        ← Previous
                    </button>

                    <div className="pagination-info">
                        Page {pagination.page} of {pagination.pages}
                    </div>

                    <button
                        className="btn btn-secondary btn-sm"
                        disabled={pagination.page === pagination.pages}
                        onClick={() => handlePageChange(pagination.page + 1)}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
