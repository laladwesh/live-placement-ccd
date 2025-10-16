# Vercel Deployment Error Fix

## Error Encountered
```
Module not found: Error: Can't resolve 'date-fns' in '/vercel/path0/backend/client/src/pages'
```

## Root Cause
The `date-fns` library was being imported in `AdminDashboard.jsx` but was not listed in the `package.json` dependencies.

## Fix Applied
Added `date-fns` version `^2.30.0` to `backend/client/package.json` dependencies.

## Files Changed
1. ✅ `backend/client/package.json` - Added date-fns dependency
2. ✅ `vercel.json` - Vercel configuration
3. ✅ `.vercelignore` - Files to ignore during deployment
4. ✅ `.env.production.example` - Production environment template
5. ✅ `VERCEL_DEPLOYMENT.md` - Deployment guide
6. ✅ `backend/package.json` - Added build scripts
7. ✅ `backend/client/.env.production` - Production React env vars
8. ✅ `backend/client/.npmrc` - npm configuration to suppress warnings

## Next Steps

### 1. Commit and Push Changes
Run the batch file or use these commands:
```bash
cd "C:\Users\Asus\OneDrive - Indian Institute of Technology Guwahati\Desktop\CCD\live-placement"

git add backend/client/package.json
git add vercel.json .vercelignore .env.production.example VERCEL_DEPLOYMENT.md
git add backend/package.json backend/client/.env.production backend/client/.npmrc

git commit -m "Add Vercel deployment configuration and fix missing date-fns dependency"

git push origin main
```

### 2. Redeploy on Vercel
Option A - Automatic (if connected to GitHub):
- Vercel will automatically detect the new push and redeploy

Option B - Manual:
- Go to your Vercel dashboard
- Click "Redeploy" on the failed deployment
- Or click "Deploy" → "Redeploy latest commit"

### 3. Verify Environment Variables (IMPORTANT!)
Make sure these are set in Vercel Dashboard → Settings → Environment Variables:

**Required:**
- `MONGO_URI` - Your MongoDB connection string
- `JWT_SECRET` - Your JWT secret key
- `NODE_ENV=production`
- `FRONTEND_ROOT` - Your Vercel app URL (e.g., https://your-app.vercel.app)

**For OAuth (if using Google):**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI` - https://your-app.vercel.app/api/auth/oauth/google/callback

**For OAuth (if using Azure/Microsoft):**
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_REDIRECT_URI` - https://your-app.vercel.app/api/auth/oauth/azure/callback

### 4. Update OAuth Redirect URIs
After deployment, update your OAuth provider settings:

**Google Cloud Console:**
- Go to APIs & Services → Credentials
- Edit your OAuth 2.0 Client ID
- Add Authorized redirect URI: `https://your-app.vercel.app/api/auth/oauth/google/callback`

**Azure Portal:**
- Go to Azure Active Directory → App registrations
- Edit your app → Authentication
- Add Redirect URI: `https://your-app.vercel.app/api/auth/oauth/azure/callback`

## Build Configuration Summary

### Vercel Build Settings
- **Framework Preset**: Other
- **Root Directory**: `./` (root)
- **Build Command**: `cd backend && npm install && npm run build`
- **Output Directory**: `backend/client/build`
- **Install Command**: `cd backend && npm install && cd client && npm install`
- **Node.js Version**: 18.x (recommended)

### What Happens During Build
1. Installs backend dependencies from `backend/package.json`
2. Installs frontend dependencies from `backend/client/package.json` (including date-fns)
3. Builds React app: `npm run build` in client folder
4. Creates production bundle in `backend/client/build`
5. Deploys serverless functions from `backend/src/server.js`

## Testing After Deployment

1. ✅ Visit your Vercel URL
2. ✅ Test login with OAuth (Google/Azure)
3. ✅ Login as admin (guptaavinash302@gmail.com)
4. ✅ Upload student CSV
5. ✅ Create company
6. ✅ Upload company shortlist
7. ✅ Test POC interview workflow
8. ✅ Test offer approval workflow

## Troubleshooting

### If build still fails:
1. Check Vercel build logs for specific errors
2. Verify all dependencies are in `dependencies`, not `devDependencies`
3. Clear Vercel cache: Settings → General → Clear Cache

### If API routes don't work:
1. Check environment variables are set correctly
2. Verify MongoDB connection string is valid
3. Check serverless function logs in Vercel dashboard

### If OAuth fails:
1. Verify redirect URIs match exactly (including https://)
2. Check OAuth credentials are set in Vercel environment variables
3. Test OAuth flow in browser console for detailed errors

## Success Indicators
✅ Build completes without errors
✅ All routes respond (/, /login, /admin, /api/health)
✅ OAuth login works
✅ MongoDB connection successful
✅ Socket.IO connects
✅ File uploads work

## Support Resources
- Vercel Docs: https://vercel.com/docs
- Vercel Support: https://vercel.com/support
- Project README: See VERCEL_DEPLOYMENT.md for detailed guide
