# Multi-stage build for production-ready job board application

# Build argument to bust cache when needed
ARG CACHE_BUST=unknown

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder

# Update npm to latest version
RUN npm install -g npm@latest

WORKDIR /app/frontend

# Copy frontend package files
COPY frontend/package*.json ./
COPY frontend/.npmrc ./

# Install dependencies (bypass platform checks but include optional deps for Rollup)
RUN npm ci --force || npm install --force

# Copy frontend source
COPY frontend/ ./

# Build the frontend
RUN npm run build

# Stage 2: Build backend and final image
FROM node:20-alpine

# Update npm to latest version
RUN npm install -g npm@latest

# Install system dependencies:
# - poppler-utils: PDF thumbnail generation (pdftocairo, pdfinfo)
# - tesseract-ocr: OCR text extraction
# - imagemagick: Image manipulation and cropping
# - ghostscript: PDF processing for ImageMagick and reportlab
# - python3, py3-pip: Python runtime for dark mode conversion
# - build-base, python3-dev, jpeg-dev, zlib-dev: Build dependencies for Python packages
RUN apk add --no-cache \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    imagemagick \
    ghostscript \
    python3 \
    py3-pip \
    build-base \
    python3-dev \
    jpeg-dev \
    zlib-dev \
    libffi-dev

# Install Python packages for dark mode PDF conversion
# Using --break-system-packages for Alpine Linux PEP 668 compliance
RUN pip3 install --no-cache-dir --break-system-packages \
    pikepdf>=8.0.0 \
    reportlab \
    Pillow>=10.0.0

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
COPY backend/.npmrc ./

# Force cache invalidation for dependency installation
ARG CACHE_BUST
RUN echo "Cache bust: $CACHE_BUST"

# Install backend dependencies (bypass platform checks but include optional deps)
# Note: Using npm install directly as this repo uses workspaces
RUN npm install --omit=dev --force

# Copy backend source (after npm install to avoid overwriting node_modules)
COPY backend/*.js ./
COPY backend/*.json ./
COPY backend/middleware ./middleware
COPY backend/utils ./utils
COPY backend/scripts ./scripts

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Create non-root user for security (principle of least privilege)
# Check what user/group has UID/GID 1000 (if any)
RUN echo "Checking existing UID 1000..." && \
    getent passwd 1000 || echo "UID 1000 is available" && \
    echo "Checking existing GID 1000..." && \
    getent group 1000 || echo "GID 1000 is available"

# Create user - Alpine will assign available GID to the group
# If UID 1000 exists, we'll handle it differently
RUN if getent passwd 1000 > /dev/null 2>&1; then \
      echo "UID 1000 already exists, will use existing user"; \
      USERNAME=$(getent passwd 1000 | cut -d: -f1); \
      echo "Existing user: $USERNAME"; \
      if [ "$USERNAME" != "appuser" ]; then \
        echo "Creating symlink from appuser to $USERNAME"; \
        ln -s /home/$USERNAME /home/appuser 2>/dev/null || true; \
      fi; \
    else \
      echo "Creating new user appuser with UID 1000"; \
      adduser -D -u 1000 appuser; \
    fi

# Create data directories for persistent storage with proper ownership
# Use UID 1000 directly in chown to avoid username issues
RUN mkdir -p data/uploads data/thumbnails data/ocr-test && \
    chown -R 1000:1000 /app && \
    chmod -R 755 /app/data

# Set environment variable for frontend path
ENV FRONTEND_PATH=/app/frontend/dist

# Switch to non-root user
# Use numeric UID to ensure we run as UID 1000 regardless of username
# After this point, all commands run as UID 1000
USER 1000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application as non-root user
CMD ["node", "server.js"]
