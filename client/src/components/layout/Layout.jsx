import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Layout.css';

export default function Layout() {
    const { user, logout, isAdmin, isEditor } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navItems = [
        { to: '/dashboard', icon: '📊', label: 'Dashboard' },
        { to: '/videos', icon: '📹', label: 'Videos' },
    ];

    // Add upload for editors and admins
    if (isEditor) {
        navItems.push({ to: '/upload', icon: '📤', label: 'Upload' });
    }

    // Add admin section for admins
    if (isAdmin) {
        navItems.push({ to: '/admin', icon: '⚙️', label: 'Admin' });
    }

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-logo">
                    <div className="sidebar-logo-icon">🎬</div>
                    <span className="sidebar-logo-text">PulseGen</span>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                        >
                            <span className="sidebar-link-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="user-details">
                            <span className="user-name">{user?.name || 'User'}</span>
                            <span className="user-role">{user?.role || 'viewer'}</span>
                        </div>
                    </div>
                    <button
                        className="btn btn-ghost btn-sm logout-btn"
                        onClick={handleLogout}
                    >
                        🚪 Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
