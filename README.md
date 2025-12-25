# PulseGen.io - Video Processing Application

A comprehensive full-stack application for video upload, sensitivity processing, and streaming with real-time progress tracking and role-based access control.

![PulseGen.io](https://img.shields.io/badge/PulseGen.io-Video%20Processing-6366f1?style=for-the-badge)

## 🚀 Features

- **Video Upload**: Drag-and-drop video upload with progress tracking
- **Sensitivity Analysis**: Automated content screening and classification (safe/flagged)
- **Real-Time Updates**: Live processing progress via Socket.io
- **Video Streaming**: HTTP range request support for efficient playback
- **Role-Based Access**: Viewer, Editor, and Admin roles
- **Multi-Tenant**: User isolation and organization-based data segregation
- **Modern UI**: Premium glassmorphism design with dark theme

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **FFmpeg** (optional, for video metadata) - [Download](https://ffmpeg.org/download.html)

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/pulsegen.io.git
cd pulsegen.io
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Configure Backend Environment

Create or edit `.env` file in the `server` directory:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/pulsegen
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRE=24h
JWT_REFRESH_EXPIRE=7d
MAX_FILE_SIZE=500000000
ALLOWED_FORMATS=mp4,mkv,avi,mov,webm
NODE_ENV=development
```

### 4. Install Frontend Dependencies

```bash
cd ../client
npm install
```

### 5. Configure Frontend Environment

The `.env` file in the `client` directory is already configured:

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

## 🏃 Running the Application

### Start MongoDB

Make sure MongoDB is running on your system:

```bash
# Windows (if installed as service)
net start MongoDB

# Or run mongod manually
mongod
```

### Start Backend Server

```bash
cd server
npm run dev
```

The backend will start at `http://localhost:5000`

### Start Frontend Development Server

In a new terminal:

```bash
cd client
npm run dev
```

The frontend will start at `http://localhost:5173`

## 📖 Usage

### 1. Register a New Account

1. Navigate to `http://localhost:5173`
2. Click "Create one" to register
3. Fill in your details and submit

### 2. Upload a Video

1. Click "Upload" in the sidebar
2. Drag and drop a video file or click to browse
3. Add optional title, description, and tags
4. Click "Upload & Process"
5. Watch real-time processing progress

### 3. View Processing Results

1. Go to "Videos" in the sidebar
2. View video status (Pending, Processing, Safe, Flagged)
3. Click on a video to watch and see details

### 4. Filter and Search Videos

- Use the search box to find videos by title
- Filter by status or classification
- Sort by date, title, or size

## 🔑 User Roles

| Role | Permissions |
|------|-------------|
| **Viewer** | View own videos, view shared videos |
| **Editor** | All Viewer permissions + upload, edit, delete videos |
| **Admin** | All Editor permissions + manage users, view all videos |

New users are created with the **Editor** role by default.

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout user |

### Videos

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/videos/upload` | Upload video |
| GET | `/api/videos` | List videos |
| GET | `/api/videos/:id` | Get video details |
| PATCH | `/api/videos/:id` | Update video |
| DELETE | `/api/videos/:id` | Delete video |

### Streaming

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stream/:id` | Stream video |
| GET | `/api/stream/:id/thumbnail` | Get thumbnail |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| PATCH | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| GET | `/api/admin/stats` | System statistics |

## 🔄 Real-Time Events

Socket.io events for live updates:

```javascript
// Subscribe to video updates
socket.emit('subscribe:video', videoId);

// Receive progress updates
socket.on('video:processing:progress', (data) => {
  // { videoId, progress, stage, message }
});

// Processing complete
socket.on('video:processing:complete', (data) => {
  // { videoId, sensitivityResult }
});

// Processing error
socket.on('video:processing:error', (data) => {
  // { videoId, error }
});
```

## 🏗️ Project Structure

```
pulsegen.io/
├── server/                 # Backend application
│   ├── config/            # Database & Socket.io config
│   ├── middleware/        # Auth, RBAC, Upload middleware
│   ├── models/            # Mongoose schemas
│   ├── routes/            # API routes
│   ├── services/          # Video processing services
│   ├── uploads/           # Video storage
│   ├── .env               # Environment variables
│   ├── package.json
│   └── server.js          # Entry point
│
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # React contexts
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   ├── App.jsx        # Main app
│   │   ├── index.css      # Global styles
│   │   └── main.jsx       # Entry point
│   ├── .env
│   ├── package.json
│   └── vite.config.js
│
└── README.md
```

## 🎨 Design System

The application uses a custom design system with:

- **Dark theme** with rich gradients
- **Glassmorphism** effects
- **Micro-animations** for enhanced UX
- **Responsive** layouts for all devices
- **CSS custom properties** for theming

## 🔒 Security

- **JWT Authentication** with access and refresh tokens
- **Password hashing** with bcrypt (12 rounds)
- **Role-based** route protection
- **Multi-tenant** data isolation
- **File validation** (type, size, format)

## 📝 Notes

### Sensitivity Analysis

The current implementation uses a **mock sensitivity analyzer** that simulates content analysis. In production, you can integrate with:

- AWS Rekognition
- Google Cloud Vision
- Azure Content Moderator
- Custom ML models

### FFmpeg

FFmpeg is used for:
- Extracting video metadata (duration, resolution)
- Generating thumbnails

If FFmpeg is not installed, the application will still work but without metadata extraction and thumbnails.

## 🐛 Troubleshooting

### MongoDB Connection Error

Make sure MongoDB is running:
```bash
mongod --dbpath /path/to/data
```

### CORS Issues

Check that the frontend URL is allowed in the backend CORS configuration.

### Video Upload Fails

- Check file size (max 500MB)
- Verify file format (mp4, webm, mov, mkv, avi)
- Check disk space

## 📄 License

MIT License - feel free to use this project for learning and development.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

---
