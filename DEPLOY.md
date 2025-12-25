# Deploying PulseGen.io

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Vercel      │────▶│     Render      │────▶│  MongoDB Atlas  │
│   (Frontend)    │     │   (Backend)     │     │   (Database)    │
│   React + Vite  │     │  Node + Express │     │    Free Tier    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## Step 1: Setup MongoDB Atlas (Database)

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas/database)
2. Create free account → Create a **FREE M0 cluster**
3. **Database Access** → Add user with password
4. **Network Access** → Add `0.0.0.0/0` (allow all IPs)
5. **Connect** → Copy connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.xxxxx.mongodb.net/pulsegen
   ```

---

## Step 2: Deploy Backend to Render

1. Go to [render.com](https://render.com) and sign up
2. Click **New** → **Web Service**
3. Connect your GitHub repo (or deploy manually)
4. Configure:
   - **Name**: `pulsegen-api`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add **Environment Variables**:
   ```
   PORT=10000
   MONGODB_URI=mongodb+srv://...your-atlas-connection-string...
   JWT_SECRET=your-super-secret-production-key-change-this
   JWT_EXPIRE=24h
   JWT_REFRESH_EXPIRE=7d
   MAX_FILE_SIZE=500000000
   ALLOWED_FORMATS=mp4,mkv,avi,mov,webm
   NODE_ENV=production
   ```
6. Deploy! Get your URL: `https://pulsegen-api.onrender.com`

---

## Step 3: Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up
2. Click **Add New** → **Project**
3. Import your GitHub repo
4. Configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add **Environment Variables**:
   ```
   VITE_API_URL=https://pulsegen-api.onrender.com/api
   VITE_SOCKET_URL=https://pulsegen-api.onrender.com
   ```
6. Deploy! Get your URL: `https://pulsegen.vercel.app`

---

## Step 4: Update Backend CORS

In `server/server.js`, update CORS for production:

```javascript
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'https://your-app.vercel.app'  // Add your Vercel domain
  ],
  credentials: true
};
```

---

## Quick Deploy Checklist

- [ ] Create MongoDB Atlas cluster and get connection string
- [ ] Deploy server to Render with environment variables
- [ ] Deploy client to Vercel with API URL pointing to Render
- [ ] Update CORS in server to allow Vercel domain
- [ ] Test registration, login, and upload

---

## Alternative: Deploy Everything to Render

If you prefer simpler setup, deploy BOTH frontend and backend to Render:

1. Deploy backend as Web Service (same as above)
2. Deploy frontend as Static Site:
   - Root Directory: `client`
   - Build Command: `npm run build`
   - Publish Directory: `dist`
