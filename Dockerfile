# Multi-stage Dockerfile for live-placement (repository root)
# Build from repo root with: docker build --build-arg REACT_APP_BASE_PATH=/dday -t live-placement .

# Stage 1: Build the React client
FROM node:18-alpine AS client-build
ARG REACT_APP_BASE_PATH
ENV REACT_APP_BASE_PATH=${REACT_APP_BASE_PATH}
WORKDIR /app/client
# Copy client package files and install dependencies
COPY client/package.json client/package-lock.json* ./
RUN npm install --legacy-peer-deps
# Ensure jspdf and jspdf-autotable are available during client build
RUN npm install jspdf jspdf-autotable --legacy-peer-deps --save
# Copy client source and build production bundle
COPY client/ .
RUN npm run build

# Stage 2: Build backend runtime image
FROM node:18-alpine AS backend-build
WORKDIR /app
# Copy backend package files and install production dependencies
COPY package.json package-lock.json* ./
RUN npm install --production --legacy-peer-deps
# Copy backend source (src/, seed.js, etc.)
COPY src/ ./src/
COPY seed.js ./
# Copy built client into backend for static serving
COPY --from=client-build /app/client/build ./client/build

# Set runtime environment
ENV NODE_ENV=production
# Expose port (compose will override with env PORT=5005)
EXPOSE 5005

# Start the server
CMD ["node", "src/server.js"]
