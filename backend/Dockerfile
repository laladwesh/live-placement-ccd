# Multi-stage Dockerfile to build client and run backend
# Stage 1: build client
FROM node:20-alpine AS client-build
WORKDIR /app/client
COPY backend/client/package.json backend/client/package-lock.json* ./
RUN npm install --legacy-peer-deps
COPY backend/client/ .
RUN npm run build

# Stage 2: build backend
FROM node:20-alpine AS backend-build
WORKDIR /app
# Install backend dependencies
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --production --legacy-peer-deps
COPY backend/ .

# Copy built client into backend for static serving
COPY --from=client-build /app/client/build ./client/build

ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "src/server.js"]
