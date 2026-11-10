import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// AI Studio container runs Nginx on port 8080 proxying traffic to port 3000.
// If PORT is 8080, bind to port 3000 to avoid EADDRINUSE with Nginx.
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const PORT = envPort === 8080 ? 3000 : (envPort || 3000);
const DIST_DIR = path.resolve(__dirname, 'dist');

// Serve static assets from dist
app.use(express.static(DIST_DIR, {
  maxAge: '1y',
  index: false,
}));

// Basic health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Single Page Application (SPA) fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Daymark production server listening on http://0.0.0.0:${PORT}`);
});
