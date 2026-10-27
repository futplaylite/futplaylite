import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const PORT = 3000;
const CLOUDFLARED_BIN = path.join(__dirname, 'cloudflared.exe');

let state = {
  publicUrl: '',
  backupUrl: '',
  lanUrl: 'http://192.168.0.102:3000',
  updatedAt: new Date().toISOString(),
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const urlPath = (req.url || '/').split('?')[0];

  if (urlPath === '/api/mobile-url') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    });
    res.end(JSON.stringify(state));
    return;
  }

  let filePath = path.join(DIST_DIR, urlPath === '/' ? 'index.html' : urlPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const raw = fs.readFileSync(filePath);
    const acceptEncoding = req.headers['accept-encoding'] || '';

    if (
      acceptEncoding.includes('gzip') &&
      (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.svg')
    ) {
      const compressed = zlib.gzipSync(raw);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
      });
      res.end(compressed);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
      });
      res.end(raw);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

function startCloudflareTunnel() {
  if (!fs.existsSync(CLOUDFLARED_BIN)) {
    setTimeout(startCloudflareTunnel, 2000);
    return;
  }

  const proc = spawn(
    CLOUDFLARED_BIN,
    [
      'tunnel',
      '--url',
      `http://127.0.0.1:${PORT}`,
      '--no-autoupdate',
      '--protocol',
      'http2',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  const handleOutput = (chunk) => {
    const text = chunk.toString();
    const matches = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi) || [];
    if (matches.length > 0) {
      const url = matches[matches.length - 1];
      if (state.publicUrl !== url) {
        state.publicUrl = url;
        state.updatedAt = new Date().toISOString();
        console.log(`[CLOUDFLARE-TUNNEL] Permanent HTTPS Mobile URL active: ${url}`);
      }
    }
  };

  proc.stdout.on('data', handleOutput);
  proc.stderr.on('data', handleOutput);
  proc.on('close', (code) => {
    console.log(`[CLOUDFLARE-TUNNEL] exited (${code}), restarting in 2s...`);
    setTimeout(startCloudflareTunnel, 2000);
  });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] FutPlay Lite Mobile Server running on http://0.0.0.0:${PORT}`);
  console.log(`[SERVER] LAN URL: ${state.lanUrl}`);
  startCloudflareTunnel();
});
