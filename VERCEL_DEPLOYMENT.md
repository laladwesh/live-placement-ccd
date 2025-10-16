# Vercel Deployment Guide

## Prerequisites
1. Install Vercel CLI: `npm install -g vercel`
2. Login to Vercel: `vercel login`

## Environment Variables
Add these environment variables in Vercel Dashboard (Settings → Environment Variables):

### Required Variables:
```
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
COOKIE_NAME=placement_token
COOKIE_MAX_AGE=3600000
JWT_EXPIRES_IN=1h
NODE_ENV=production
PORT=4000
```

### OAuth Variables (Google):
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/oauth/google/callback
```

### OAuth Variables (Azure/Microsoft):
```
AZURE_CLIENT_ID=your_azure_client_id
AZURE_CLIENT_SECRET=your_azure_client_secret
AZURE_TENANT_ID=your_azure_tenant_id
AZURE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/oauth/azure/callback
```

### Frontend URL:
```
FRONTEND_ROOT=https://your-domain.vercel.app
```

## Deployment Commands

### First Time Deployment:
```bash
# Navigate to project root
cd "C:\Users\Asus\OneDrive - Indian Institute of Technology Guwahati\Desktop\CCD\live-placement"

# Deploy to Vercel
vercel
```

### Production Deployment:
```bash
vercel --prod
```

### Using Vercel Dashboard:
1. Go to https://vercel.com/new
2. Import your GitHub repository: `laladwesh/live-placement-ccd`
3. Configure project:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (leave as root)
   - **Build Command**: `cd backend && npm install && npm run build`
   - **Output Directory**: `backend/client/build`
   - **Install Command**: `cd backend && npm install && cd client && npm install`
4. Add all environment variables listed above
5. Click "Deploy"

## Automatic Deployments
Once connected to GitHub:
- Every push to `main` branch will automatically deploy to production
- Pull requests will create preview deployments

## Build Process
The build process will:
1. Install backend dependencies (`backend/package.json`)
2. Install frontend dependencies (`backend/client/package.json`)
3. Build React app (`npm run build` in client folder)
4. Serve static files from `backend/client/build`
5. API routes will be handled by `backend/src/server.js`

## Post-Deployment Checklist
- ✅ Verify MongoDB connection is working
- ✅ Test OAuth login flows (Google/Azure)
- ✅ Verify Socket.IO connections
- ✅ Test file uploads (CSV)
- ✅ Check CORS settings
- ✅ Test admin dashboard
- ✅ Test POC functionality
- ✅ Test student views

## Troubleshooting

### Build Fails:
- Check Vercel build logs
- Ensure all dependencies are in `dependencies` not `devDependencies`
- Verify Node version compatibility

### API Routes Not Working:
- Check `vercel.json` routing configuration
- Verify environment variables are set correctly
- Check serverless function logs in Vercel dashboard

### OAuth Issues:
- Update redirect URIs in Google/Azure console to match Vercel URL
- Verify all OAuth environment variables are set

### Socket.IO Issues:
- Socket.IO may need WebSocket configuration
- Consider using polling transport as fallback

## Local Testing of Production Build
```bash
# Build React app
cd backend/client
npm run build

# Start production server
cd ..
NODE_ENV=production node src/server.js
```

## Custom Domain Setup
1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Update OAuth redirect URIs to use custom domain
4. Update `FRONTEND_ROOT` environment variable

## Performance Tips
- Frontend static files are served via Vercel CDN
- API routes run as serverless functions
- Consider MongoDB connection pooling for better performance
- Use environment variables for all secrets
