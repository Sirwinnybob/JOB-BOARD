# Job Board Web Application

A production-ready, full-stack job board application with PDF preview grid and real-time updates, built for containerized deployment.

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/Sirwinnybob/JOB-BOARD)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## Features

- **PDF Grid View**: Configurable grid layout (default 6×4) with thumbnail previews
- **Full-Screen PDF Viewer**: Click any thumbnail to view the full PDF
- **Admin Panel**: Secure authentication with drag-and-drop reordering
- **Label System**: Apply colored labels (NEW, MOVED, PENDING, URGENT, COMPLETED) to PDFs
- **Real-Time Updates**: WebSocket-based live synchronization across all devices
- **Push Notifications**: Background notifications for job updates (works even when app is closed)
- **iOS-Style Drag & Drop**: Smooth, snap-to-grid reordering with visual feedback
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Auto-Thumbnail Generation**: Automatic first-page thumbnail creation
- **Grid Customization**: Admin can change rows/columns via settings
- **Dockerized**: Production-ready Docker container with multi-stage build
- **PWA Support**: Progressive Web App with offline capabilities

## Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS + React DnD
- **Backend**: Node.js + Express + WebSocket (ws)
- **Real-Time**: WebSocket for live updates
- **Database**: SQLite (file-based, container-friendly)
- **PDF Processing**: pdf-poppler (thumbnail generation)
- **Authentication**: JWT-based secure login
- **Container**: Docker + Docker Compose

## Project Structure

```
JOB-BOARD/
├── backend/
│   ├── middleware/          # Auth middleware
│   ├── utils/              # Thumbnail generation & push notifications
│   ├── db.js               # Database initialization
│   ├── server.js           # Express server with WebSocket
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components (Home, Admin)
│   │   ├── utils/          # API utilities & WebSocket client
│   │   └── App.jsx
│   ├── public/             # PWA assets & service worker
│   ├── index.html
│   └── package.json
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Container orchestration
└── README.md
```

## Quick Start (Development)

### Prerequisites

- Node.js 20+
- npm or yarn
- poppler-utils (for PDF processing)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Sirwinnybob/JOB-BOARD.git
cd JOB-BOARD
```

2. Install dependencies:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Configure environment:
```bash
cd ../backend
cp .env.example .env
# Edit .env and set secure credentials
```

4. Start development servers:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

5. Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Production Deployment

### Using Docker Compose (Recommended)

1. **Create `.env` file** in the project root:
```bash
cp .env.example .env
```

2. **Configure environment variables**:
```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Set admin credentials
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
```

3. **Deploy with Docker Compose**:
```bash
docker-compose up -d
```

4. **Access the application**:
   - Application: http://localhost:3000
   - Admin Panel: http://localhost:3000/admin

### Deploying with Dockge (TrueNAS/Portainer)

1. In your container management UI, create a new stack named `job-board`
2. Use the provided `docker-compose.yml` file
3. Set environment variables in the UI:
   - `JWT_SECRET`: Your generated secret
   - `ADMIN_USERNAME`: Your admin username
   - `ADMIN_PASSWORD`: Your secure password
4. Deploy the stack

### Reverse Proxy Configuration (HTTPS)

#### Nginx Proxy Manager

1. **Add Proxy Host**:
   - Domain: `your-domain.com`
   - Scheme: `http`
   - Forward Hostname/IP: `job-board-app` (or container IP)
   - Forward Port: `3000`
   - **Enable: WebSocket Support** (Required!)
   - **Disable: Cache Assets** (Important for WebSocket)
   - Enable: Block Common Exploits

2. **SSL Certificate**:
   - Enable SSL
   - Request Let's Encrypt Certificate
   - Enable Force SSL
   - Enable HTTP/2 Support

#### Manual Nginx Configuration

Create nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # WebSocket support (required!)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Standard proxy headers
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:
```bash
ln -s /etc/nginx/sites-available/jobboard.conf /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

## Usage

### Public View

1. Visit your application URL
2. Browse PDF thumbnails in the grid
3. View colored labels (NEW, MOVED, PENDING, etc.) on PDFs
4. Click any thumbnail to view full PDF
5. Press ESC or click X to close the viewer
6. Real-time updates appear automatically when admin makes changes

### Admin Panel

1. Navigate to `/admin`
2. Log in with your admin credentials
3. **Upload PDFs**: Click "Upload PDF" button
4. **Edit Mode**: Click "Edit Mode" to enable drag-and-drop
   - Drag PDFs to reorder them
   - Click the tag icon to manage labels
   - Click X button to delete PDFs
   - Click "Done Editing" when finished
5. **Settings**: Click "Settings" to change grid dimensions
6. **Notifications**: Send custom push notifications to all subscribed devices

### Label Management

1. In Edit Mode, click the purple tag icon on any PDF
2. Select/deselect labels to apply to the PDF
3. Available labels: NEW (green), MOVED (blue), PENDING (amber), URGENT (red), COMPLETED (purple)
4. Click "Save" to apply changes
5. Labels are visible in both public and admin views

### Real-Time Updates

The application uses WebSocket for live synchronization:

- **No page refresh required** - changes appear instantly on all devices
- Automatic reconnection on disconnect (exponential backoff, up to 10 attempts)
- All connected clients receive updates simultaneously

**Update Types:**
- `pdf_uploaded` - New PDF added
- `pdf_deleted` - PDF removed
- `pdfs_reordered` - PDFs rearranged
- `pdf_labels_updated` - PDF labels changed
- `label_created` - New label created
- `label_deleted` - Label removed
- `settings_updated` - Grid dimensions changed

## Push Notifications

This application supports Web Push notifications that work even when the PWA is closed. See **[PUSH_NOTIFICATIONS_SETUP.md](PUSH_NOTIFICATIONS_SETUP.md)** for complete setup guide.

### Quick Start

1. **Generate VAPID Keys**: Open `generate-vapid-keys.html` in your browser
2. **Add to .env**: Copy the keys to your environment variables
3. **Restart Backend**: Apply the configuration
4. **Subscribe Devices**: Use the browser's notification permission prompt or admin panel

**Notification Types:**
- **NEW JOB**: When jobs are published or moved from pending to active
- **JOB(S) MOVED**: When jobs are reordered on the board
- **Custom Alerts**: Admins can send custom notifications anytime

## API Reference

### Public Endpoints

- `GET /api/pdfs` - Get all PDFs (includes labels)
- `GET /api/labels` - Get all available labels
- `GET /api/settings` - Get grid settings
- `GET /api/health` - Health check

### Admin Endpoints (Require JWT)

- `POST /api/auth/login` - Admin login
- `POST /api/pdfs` - Upload PDF
- `DELETE /api/pdfs/:id` - Delete PDF
- `PUT /api/pdfs/reorder` - Reorder PDFs
- `PUT /api/pdfs/:id/labels` - Update PDF labels
- `POST /api/labels` - Create new label
- `DELETE /api/labels/:id` - Delete label
- `PUT /api/settings` - Update grid settings
- `POST /api/notifications/send` - Send push notification

## Data Persistence

Docker volumes ensure data persists across container restarts:

- `./data/uploads` - PDF files
- `./data/thumbnails` - Generated thumbnails
- `./data/database.sqlite` - SQLite database file

**Important: Backup these directories regularly!**

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | `3000` | No |
| `NODE_ENV` | Environment | `production` | No |
| `JWT_SECRET` | JWT signing secret | - | **Yes** |
| `ADMIN_USERNAME` | Admin username | - | **Yes** |
| `ADMIN_PASSWORD` | Admin password | - | **Yes** |
| `COMPANY_NAME` | Full company name shown in header | `Job Board` | No |
| `COMPANY_SHORT_NAME` | Short name for mobile header | `Job Board` | No |
| `VAPID_PUBLIC_KEY` | Web Push public key | - | No* |
| `VAPID_PRIVATE_KEY` | Web Push private key | - | No* |
| `VAPID_SUBJECT` | Contact email for push service | `mailto:admin@example.com` | No |

*Required only if using push notifications

## Security Considerations

1. **Change default credentials** in `.env`
2. **Use strong JWT secret** (32+ characters, generated with `openssl rand -base64 32`)
3. **Enable HTTPS** via reverse proxy
4. **Rate limiting** enabled (100 requests/15 minutes per IP)
5. **File upload restrictions**: PDF only, max 50MB
6. **Helmet.js** security headers enabled
7. **CORS** properly configured for production

## Troubleshooting

### Container Issues

**Container won't start:**
```bash
# Check logs
docker logs job-board-app

# Verify environment variables
docker exec job-board-app env | grep -E "JWT|ADMIN"
```

**502 Bad Gateway:**
```bash
# Verify container is running
docker ps | grep job-board

# Check backend health
curl http://localhost:3000/api/health
```

### PDF Processing

**Thumbnails not generating:**
```bash
# Verify poppler is installed
docker exec job-board-app which pdftoppm

# Check permissions
docker exec job-board-app ls -la /app/thumbnails
```

**Upload fails:**
```bash
# Check upload directory permissions
docker exec job-board-app ls -la /app/uploads

# Verify disk space
df -h

# Check client_max_body_size in nginx (should be 50M+)
```

### WebSocket Issues

If real-time updates aren't working over HTTPS:

1. **Verify WebSocket support enabled** in your reverse proxy
2. **Disable "Cache Assets"** in Nginx Proxy Manager (breaks WebSocket)
3. **Check browser console** (F12) for WebSocket connection errors
4. **Verify upgrade headers** are configured in nginx

**Browser Console Check:**
- Should see: `✅ WebSocket connected successfully`
- Not: `❌ WebSocket error` or close code 1006

**Nginx configuration must include:**
```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
proxy_cache_bypass $http_upgrade;
```

### Authentication Issues

**Can't log in:**
```bash
# Verify credentials in .env
cat .env

# Check JWT secret is set
docker exec job-board-app printenv JWT_SECRET

# Check backend logs for auth errors
docker logs job-board-app | grep -i auth
```

## Performance

- **Multi-stage Docker build** reduces image size (~300MB final)
- **Static assets** served via Express with compression
- **PDF thumbnails** cached and reused
- **Lazy loading** for thumbnail images
- **Production build** optimized with Vite
- **WebSocket** connection pooling and heartbeat

For scaling considerations, see **[SCALABILITY.md](SCALABILITY.md)**

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

## Development

### Build Frontend
```bash
cd frontend
npm run build
```

### Build Docker Image
```bash
docker build -t job-board-app .
```

### Run Tests
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with React, Express, and Docker
- PDF processing by pdf-poppler
- Drag-and-drop by react-dnd
- Styling by Tailwind CSS
- WebSocket by ws library

## Support

For issues or questions, please open an issue on GitHub: [https://github.com/Sirwinnybob/JOB-BOARD/issues](https://github.com/Sirwinnybob/JOB-BOARD/issues)

---

**Version 1.0.0** - Production Ready
