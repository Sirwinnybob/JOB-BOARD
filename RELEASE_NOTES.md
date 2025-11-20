# Job Board v1.0 Release Notes

**Release Date:** January 2025
**Status:** Production Ready ✅

## Overview

Job Board v1.0 is a production-ready, full-stack web application designed for displaying PDF delivery sheets and project tracking in a grid layout. Built with React, Node.js, and Docker, it provides real-time updates, push notifications, and a mobile-first Progressive Web App (PWA) experience.

## 🎉 What's New in v1.0

### Core Features

#### PDF Management
- **Grid-based PDF viewer** with configurable dimensions (default 6×4)
- **Auto-thumbnail generation** using pdf-poppler
- **Full-screen PDF viewer** with keyboard navigation (ESC to close)
- **Drag-and-drop reordering** with iOS-style snap-to-grid
- **Pending/Published workflow** for draft management
- **Dark mode PDF conversion** using vector-based transformation (optional feature)

#### Label System
- **Color-coded labels**: NEW (green), MOVED (blue), PENDING (amber), URGENT (red), COMPLETED (purple)
- **Multi-label support** for PDFs
- **Admin label management** (create, delete, assign)
- Visible on both public and admin views

#### Real-Time Updates
- **WebSocket-based live synchronization** across all connected devices
- **Automatic reconnection** with exponential backoff (up to 10 attempts)
- **Instant updates** for PDF uploads, deletions, reordering, and label changes
- No page refresh required

#### Push Notifications
- **Web Push API integration** for background notifications
- **VAPID keys** for secure push service authentication
- **Notification types**:
  - NEW JOB: When jobs are published
  - JOB(S) MOVED: When jobs are reordered
  - Custom alerts from admin panel
- Works even when app is closed
- Per-device subscription management

#### Admin Panel
- **Secure JWT-based authentication**
- **Upload interface** for PDFs (max 50MB)
- **Edit mode** with visual indicators
- **Settings modal** for grid customization
- **Label management** interface
- **Custom notification sender**
- **Delivery schedule viewer** with pending job workflow

#### Progressive Web App (PWA)
- **Installable on all platforms** (iOS, Android, Desktop)
- **Offline-capable** with service worker
- **App-like experience** with custom icons and splash screens
- **Optimized for mobile** with responsive design

#### OCR & Metadata Extraction (Advanced Feature)
- **Tesseract OCR integration** for text extraction
- **Configurable region-based extraction** for job numbers and construction methods
- **Automatic metadata extraction** during upload
- **OCR settings page** for admin region configuration

#### Dark Mode Support
- **System preference detection**
- **Manual toggle** in header
- **Persistent preference** via localStorage
- **Smooth transitions** across all UI elements

### Technical Improvements

#### Backend
- **Express.js** REST API with WebSocket server
- **SQLite database** for lightweight, file-based storage
- **JWT authentication** with configurable secrets
- **Rate limiting** (100 requests/15 minutes per IP)
- **Helmet.js** security headers
- **CORS** properly configured
- **Multer** for file upload handling
- **Web Push** library for push notifications

#### Frontend
- **React 18** with hooks
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for modern, responsive styling
- **React DnD** for drag-and-drop functionality
- **PDF.js** for PDF rendering in browser
- **Service Worker** for PWA functionality

#### DevOps
- **Multi-stage Docker build** (~300MB final image)
- **Docker Compose** for easy deployment
- **Volume mounting** for persistent data
- **Health checks** for container monitoring
- **Auto-restart** on failure
- **Nginx-ready** with WebSocket proxy support

## 🔧 Configuration Options

### Environment Variables

All configuration is done via environment variables for maximum flexibility:

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `JWT_SECRET` | JWT signing secret | - | **Yes** |
| `ADMIN_USERNAME` | Admin username | - | **Yes** |
| `ADMIN_PASSWORD` | Admin password | - | **Yes** |
| `COMPANY_NAME` | Full company name | `Job Board` | No |
| `COMPANY_SHORT_NAME` | Short name for mobile | `Job Board` | No |
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment | `production` | No |
| `VAPID_PUBLIC_KEY` | Web Push public key | - | No* |
| `VAPID_PRIVATE_KEY` | Web Push private key | - | No* |
| `VAPID_SUBJECT` | Push service contact email | `mailto:admin@example.com` | No |

*Required only for push notifications

### Grid Configuration

Customize the PDF grid via admin settings:
- **Rows**: 1-12
- **Columns**: 1-12
- **Aspect Ratio**: Width and height for thumbnail sizing
- Changes apply instantly to all connected clients

### Company Branding

**New in v1.0:** Configurable company branding via environment variables:

```bash
COMPANY_NAME=Your Company Name
COMPANY_SHORT_NAME=YCN
```

This customizes:
- Header text (responsive: full name on desktop, short on mobile)
- Document title (via settings API)
- Can be changed without code modifications

## 📦 Installation & Deployment

### Quick Start (Docker Compose)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Sirwinnybob/JOB-BOARD.git
   cd JOB-BOARD
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Deploy:**
   ```bash
   docker-compose up -d
   ```

4. **Access:**
   - Application: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

### Production Deployment

For production deployments with HTTPS:

1. Use a reverse proxy (Nginx Proxy Manager recommended)
2. Enable WebSocket support in proxy configuration
3. **Important:** Disable "Cache Assets" option (breaks WebSocket)
4. Configure SSL certificates via Let's Encrypt
5. Backup `./data` directory regularly

See [README.md](README.md) for detailed deployment instructions.

## 🔐 Security Features

- **JWT-based authentication** with configurable secrets
- **Password hashing** (not stored in plain text)
- **Rate limiting** to prevent abuse
- **Helmet.js** security headers
- **CORS** configured for production
- **File type validation** (PDF only)
- **File size limits** (50MB max)
- **SQL injection prevention** via parameterized queries
- **XSS protection** via React's built-in sanitization

## 🎨 User Interface Highlights

### Public View
- Clean, grid-based layout
- Color-coded labels visible on thumbnails
- Full-screen PDF viewer
- Real-time updates without refresh
- Dark mode toggle
- Responsive mobile design
- Delivery schedule modal

### Admin View
- All public features plus:
- Upload button with drag-and-drop
- Edit mode with visual reordering
- Label management (assign, create, delete)
- Settings modal for grid customization
- Push notification sender
- Pending section for draft jobs
- Authentication required

## 🚀 Performance

- **Fast initial load**: ~1-2 seconds on average connection
- **Lazy loading**: Images load as needed
- **Optimized thumbnails**: 200 DPI for balance of quality/size
- **Compressed frontend**: Vite production build
- **WebSocket efficiency**: Binary frames disabled for lower overhead
- **Multi-stage Docker**: Reduced image size
- **Cached assets**: Service worker for offline access

## 📊 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- iOS Safari 14+
- Chrome Mobile

## 🐛 Known Issues & Limitations

1. **WebSocket over HTTPS**: Ensure reverse proxy has WebSocket support enabled and "Cache Assets" disabled
2. **OCR Accuracy**: Text extraction accuracy depends on PDF quality
3. **Large PDFs**: Files over 20MB may take longer to process
4. **Safari Push Notifications**: Limited support on iOS (web push not fully supported)
5. **PDF Dark Mode**: Experimental feature, may not work perfectly with all PDF formats

## 📝 Breaking Changes from Pre-Release

- Removed company-specific branding (now configurable via env vars)
- Removed example PDF files from repository
- Removed testing/troubleshooting scripts (test-https-wss.sh, diagnose-network.sh)
- Removed HTTPS_TROUBLESHOOTING.md (info consolidated into README)

### Migration from Pre-1.0

If upgrading from a development version:

1. **Add new environment variables:**
   ```bash
   COMPANY_NAME=Your Company Name
   COMPANY_SHORT_NAME=YCN
   ```

2. **No database migrations required** - existing data is compatible

3. **Service worker cache**: Users may need to hard refresh (Ctrl+Shift+R) once

## 🛠️ Development

### Prerequisites
- Node.js 20+
- npm or yarn
- poppler-utils (for PDF processing)
- tesseract (optional, for OCR)
- python3 + pikepdf (optional, for dark mode)

### Local Development
```bash
# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start backend
cd backend && npm run dev

# Start frontend (separate terminal)
cd frontend && npm run dev
```

## 📚 Documentation

- **[README.md](README.md)**: Complete setup and deployment guide
- **[PUSH_NOTIFICATIONS_SETUP.md](PUSH_NOTIFICATIONS_SETUP.md)**: Push notification configuration
- **[SCALABILITY.md](SCALABILITY.md)**: Scaling considerations
- **[LICENSE](LICENSE)**: MIT License

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with React, Express, and Docker
- PDF processing by pdf-poppler
- Drag-and-drop by react-dnd
- Styling by Tailwind CSS
- WebSocket by ws library
- OCR by Tesseract
- Dark mode conversion based on pdf-dark-mode-converter

## 💬 Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/Sirwinnybob/JOB-BOARD/issues

---

**Thank you for using Job Board v1.0!** 🎉

We hope this application serves your team well. If you find it useful, please consider starring the repository on GitHub.
