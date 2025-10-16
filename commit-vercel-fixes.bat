@echo off
echo ====================================
echo Committing Vercel Deployment Fixes
echo ====================================

cd "C:\Users\Asus\OneDrive - Indian Institute of Technology Guwahati\Desktop\CCD\live-placement"

echo.
echo Adding date-fns dependency...
git add backend/client/package.json

echo Adding Vercel configuration files...
git add vercel.json
git add .vercelignore
git add .env.production.example
git add VERCEL_DEPLOYMENT.md
git add backend/package.json
git add backend/client/.env.production
git add backend/client/.npmrc

echo.
echo Committing changes...
git commit -m "Add Vercel deployment configuration and fix missing date-fns dependency"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ====================================
echo Done! Your changes are pushed.
echo Now redeploy on Vercel.
echo ====================================
pause
