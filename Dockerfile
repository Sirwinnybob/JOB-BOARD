# Multi-stage build for production-ready job board application

# Build argument to bust cache when needed
ARG CACHE_BUST=unknown

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
COPY frontend/.npmrc ./

# Install dependencies (skip optional packages and bypass platform checks)
RUN npm ci --no-optional --force || npm install --no-optional --force

# Copy frontend source
COPY frontend/ ./

# Build the frontend
RUN npm run build

# Stage 2: Build backend and final image
FROM node:20-alpine

# Install poppler-utils for PDF thumbnail generation
RUN apk add --no-cache poppler-utils

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
COPY backend/.npmrc ./

# Force cache invalidation for dependency installation
ARG CACHE_BUST
RUN echo "Cache bust: $CACHE_BUST"

# Install backend dependencies (skip optional packages and bypass platform checks)
RUN npm ci --omit=dev --no-optional --force || npm install --omit=dev --no-optional --force

# Copy backend source (after npm install to avoid overwriting node_modules)
COPY backend/*.js ./
COPY backend/*.json ./
COPY backend/middleware ./middleware
COPY backend/utils ./utils

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create data directory for persistent storage
RUN mkdir -p data && chmod 755 data

# Set environment variable for frontend path
ENV FRONTEND_PATH=/app/frontend/dist

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]
