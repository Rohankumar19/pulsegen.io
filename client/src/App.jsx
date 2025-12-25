import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { VideoProvider } from './context/VideoContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import VideoLibrary from './pages/VideoLibrary';
import VideoWatch from './pages/VideoWatch';

// Components
import Layout from './components/layout/Layout';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div style={{ textAlign: 'center' }}>
            <div className="spinner-large" style={{
              width: 48,
              height: 48,
              border: '4px solid var(--glass-border)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto var(--space-4)'
            }}></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Public Route wrapper (redirect if already authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// App with providers
function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />

      {/* Protected routes with Layout */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <SocketProvider>
              <VideoProvider>
                <Layout />
              </VideoProvider>
            </SocketProvider>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="videos" element={<VideoLibrary />} />
        <Route path="upload" element={<Upload />} />
        <Route path="watch/:id" element={<VideoWatch />} />
      </Route>

      {/* 404 */}
      <Route
        path="*"
        element={
          <div className="auth-page">
            <div className="auth-container" style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>404</h1>
              <p style={{ marginBottom: 'var(--space-6)' }}>Page not found</p>
              <a href="/" className="btn btn-primary">Go Home</a>
            </div>
          </div>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
