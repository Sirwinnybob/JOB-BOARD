# Job Board Web Application

A production-ready, full-stack job board application with PDF preview grid, built for deployment on TrueNAS using Dockge.

## Features

- **PDF Grid View**: Configurable grid layout (default 6×4) with thumbnail previews
- **Full-Screen PDF Viewer**: Click any thumbnail to view the full PDF
- **Admin Panel**: Secure authentication with drag-and-drop reordering
- **Label System**: Apply colored labels (NEW, MOVED, PENDING, URGENT, COMPLETED) to PDFs
- **Real-Time Updates**: WebSocket-based live synchronization across all devices
- **iOS-Style Drag & Drop**: Smooth, snap-to-grid reordering with visual feedback
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Auto-Thumbnail Generation**: Automatic first-page thumbnail creation
- **Grid Customization**: Admin can change rows/columns via settings
- **Dockerized**: Production-ready Docker container with multi-stage build

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
│   ├── utils/              # Thumbnail generation
│   ├── db.js               # Database initialization
│   ├── server.js           # Express server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── utils/          # API utilities
│   │   └── App.jsx
│   ├── index.html
│   └── package.json
├── Dockerfile              # Multi-stage build
├── docker-compose.yml
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
git clone <repository-url>
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

## Production Deployment on TrueNAS with Dockge

### Step 1: Prepare Environment

1. **Create `.env` file** in the project root:
```bash
cp .env.example .env
```

2. **Edit `.env` with secure credentials**:
```bash
# Generate a secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Set admin credentials
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
```

### Step 2: Deploy with Dockge

1. **In Dockge UI**, create a new stack named `job-board`

2. **Paste the docker-compose.yml content** or use the file directly

3. **Set environment variables** in Dockge:
   - `JWT_SECRET`: Your generated secret
   - `ADMIN_USERNAME`: Your admin username
   - `ADMIN_PASSWORD`: Your secure password

4. **Deploy the stack**

### Step 3: Configure Reverse Proxy (Nginx Proxy Manager)

#### Option A: Using Nginx Proxy Manager UI

1. **Add Proxy Host**:
   - Domain: `jobboard.kustomkraftcabinets.ddns.net`
   - Scheme: `http`
   - Forward Hostname/IP: `job-board-app` (container name)
   - Forward Port: `3000`
   - Enable: WebSocket Support
   - Enable: Block Common Exploits

2. **SSL Certificate**:
   - Enable SSL
   - Request Let's Encrypt Certificate
   - Enable Force SSL
   - Enable HTTP/2 Support

#### Option B: Manual Nginx Configuration

Create `/etc/nginx/sites-available/jobboard.conf`:

```nginx
server {
    listen 80;
    server_name jobboard.kustomkraftcabinets.ddns.net;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name jobboard.kustomkraftcabinets.ddns.net;

    ssl_certificate /etc/letsencrypt/live/jobboard.kustomkraftcabinets.ddns.net/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/jobboard.kustomkraftcabinets.ddns.net/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
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

### Step 4: SSL Certificate Setup

If using Let's Encrypt directly:

```bash
certbot certonly --nginx -d jobboard.kustomkraftcabinets.ddns.net
```

The certificates will be stored in:
```
/etc/letsencrypt/live/jobboard.kustomkraftcabinets.ddns.net/
```

### Step 5: Verify Deployment

1. **Check container status**:
```bash
docker ps | grep job-board
docker logs job-board-app
```

2. **Access the application**:
   - Public: https://jobboard.kustomkraftcabinets.ddns.net
   - Admin: https://jobboard.kustomkraftcabinets.ddns.net/admin

3. **Test health endpoint**:
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"ok"}
```

## Usage

### Public View

1. Visit `https://jobboard.kustomkraftcabinets.ddns.net`
2. Browse PDF thumbnails in the grid
3. View colored labels (NEW, MOVED, PENDING, etc.) on PDFs
4. Click any thumbnail to view full PDF
5. Press ESC or click X to close the viewer

### Admin Panel

1. Visit `https://jobboard.kustomkraftcabinets.ddns.net/admin`
2. Log in with your admin credentials
3. **Upload PDFs**: Click "Upload PDF" button
4. **Edit Mode**: Click "Edit Mode" to enable drag-and-drop
   - Drag PDFs to reorder them
   - Click the tag icon to manage labels for a PDF
   - Click X button to delete PDFs
   - Click "Done Editing" when finished
5. **Settings**: Click "Settings" to change grid dimensions

### Label Management

1. In Edit Mode, click the purple tag icon on any PDF
2. Select/deselect labels to apply to the PDF
3. Available labels: NEW (green), MOVED (blue), PENDING (amber), URGENT (red), COMPLETED (purple)
4. Click "Save" to apply changes
5. Labels are visible in both public and admin views

### Real-Time Updates

The application uses WebSocket for live synchronization across all connected devices:

**How it works:**
- When an admin makes changes (upload, delete, reorder, label updates, settings changes), the server broadcasts updates via WebSocket
- All connected clients (both public viewers and other admins) automatically receive and apply the updates
- **No page refresh required** - changes appear instantly on all devices

**Update Types:**
- `pdf_uploaded` - New PDF added
- `pdf_deleted` - PDF removed
- `pdfs_reordered` - PDFs rearranged
- `pdf_labels_updated` - PDF labels changed
- `label_created` - New label created
- `label_deleted` - Label removed
- `settings_updated` - Grid dimensions changed

**Connection Features:**
- Automatic reconnection on disconnect (exponential backoff)
- Up to 10 reconnection attempts
- Maximum 30-second delay between attempts

## API Endpoints

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

## Data Persistence

Docker volumes ensure data persists across container restarts:

- `./data/uploads` - PDF files
- `./data/thumbnails` - Generated thumbnails
- `./data/database` - SQLite database

**Backup these directories regularly!**

## Security Considerations

1. **Change default credentials** in `.env`
2. **Use strong JWT secret** (32+ characters)
3. **Enable HTTPS** via reverse proxy
4. **Rate limiting** is enabled (100 req/15min per IP)
5. **File upload restrictions**: PDF only, max 50MB
6. **Helmet.js** security headers enabled

## Troubleshooting

### Container won't start
```bash
# Check logs
docker logs job-board-app

# Check environment variables
docker exec job-board-app env | grep JWT
```

### PDF thumbnails not generating
```bash
# Verify poppler is installed
docker exec job-board-app which pdftoppm

# Check permissions
docker exec job-board-app ls -la /app/thumbnails
```

### Upload fails
```bash
# Check upload directory permissions
docker exec job-board-app ls -la /app/uploads

# Check disk space
df -h
```

### Can't log in
```bash
# Verify credentials in .env
cat .env

# Check JWT secret is set
docker exec job-board-app printenv JWT_SECRET
```

## Development

### Build frontend
```bash
cd frontend
npm run build
```

### Build Docker image
```bash
docker build -t job-board-app .
```

### Run tests
```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `production` |
| `JWT_SECRET` | JWT signing secret | Required |
| `ADMIN_USERNAME` | Admin username | Required |
| `ADMIN_PASSWORD` | Admin password | Required |

## Performance

- **Multi-stage build** reduces image size
- **Static assets** served via Express
- **PDF thumbnails** cached and reused
- **Lazy loading** for thumbnail images
- **Production build** optimized with Vite

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT

## Support

For issues or questions, please open an issue on GitHub.

## Acknowledgments

- Built with React, Express, and Docker
- PDF processing by pdf-poppler
- Drag-and-drop by react-dnd
- Styling by Tailwind CSS
