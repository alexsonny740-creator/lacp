'use strict';

const http = require('http');
const express = require('express');
const { registerFavicon, injectFavicon } = require('./favicon');

const app = express();

// ============================================================
// CONFIG
// ============================================================

const HOST = process.env.HOST || '0.0.0.0';

// The host assigns the port (if any) through the environment.
// The public domain never includes a port, so nothing below depends on it.
const LISTEN_PORT = process.env.PORT || process.env.SERVER_PORT || 3000;

const PUBLIC_URL = (
  process.env.PUBLIC_URL || 'https://lacp.apps.bot-hosting.cloud'
).replace(/\/+$/, '');

const PUBLIC_HOST = PUBLIC_URL.replace(/^https?:\/\//, '');

const TARGET_HOST = process.env.TARGET_HOST || '195.123.189.186';
const TARGET_PORT = Number(process.env.TARGET_PORT || 2675);
const TARGET_ORIGIN = `http://${TARGET_HOST}:${TARGET_PORT}`;
const TARGET_ORIGIN_HTTPS = `https://${TARGET_HOST}:${TARGET_PORT}`;

const NO_CACHE = 'no-store, no-cache, must-revalidate, proxy-revalidate';

app.disable('x-powered-by');
app.set('trust proxy', true);

const agent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 100,
  maxFreeSockets: 20,
  timeout: 30000,
  scheduling: 'lifo'
});

registerFavicon(app);

// ============================================================
// UNAVAILABLE PAGE
// ============================================================

function unavailablePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="icon" type="image/webp" href="/favicon.webp?v=1">
    <link rel="shortcut icon" type="image/webp" href="/favicon.webp?v=1">
    <title>Los Angeles California Roleplay - Unavailable</title>
    <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
        body {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            background: radial-gradient(circle at top, #29141a 0%, #120c10 42%, #08090c 100%);
            color: #f5f5f6;
            font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .container { width: 100%; max-width: 520px; text-align: center; }
        .icon {
            width: 88px; height: 88px;
            margin: 0 auto 28px;
            border-radius: 22px;
            object-fit: cover;
            display: block;
            box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
        }
        .status {
            display: inline-flex; align-items: center; gap: 9px;
            padding: 8px 13px; margin-bottom: 18px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.045);
            color: #aeb0b7;
            font-size: 13px; font-weight: 600;
        }
        .dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #ef4444;
            box-shadow: 0 0 14px rgba(239, 68, 68, 0.65);
        }
        h1 {
            margin: 0 0 12px;
            font-size: clamp(28px, 6vw, 40px);
            line-height: 1.1;
            letter-spacing: -0.03em;
        }
        p { margin: 0 auto; max-width: 440px; color: #9b969a; font-size: 16px; line-height: 1.7; }
        .retry {
            display: inline-block; margin-top: 28px; padding: 11px 18px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            background: rgba(255, 255, 255, 0.055);
            color: #e8e5e7;
            text-decoration: none;
            font-size: 14px; font-weight: 600;
        }
        .retry:hover { background: rgba(255, 255, 255, 0.09); border-color: rgba(255, 255, 255, 0.18); }
        .footer { margin-top: 32px; color: #655d61; font-size: 12px; }
    </style>
</head>
<body>
    <main class="container">
        <img class="icon" src="/favicon.webp?v=1" alt="Los Angeles California Roleplay">
        <div class="status"><span class="dot"></span>Currently unavailable</div>
        <h1>Los Angeles California Roleplay</h1>
        <p>The main server is currently unavailable. Please try again in a few moments.</p>
        <a class="retry" href="/" onclick="location.reload(); return false;">Try again</a>
        <div class="footer">The connection will automatically work again once the main server is back online.</div>
    </main>
</body>
</html>`;
}

function sendUnavailable(res, statusCode = 503) {
  if (res.headersSent || res.writableEnded) return;

  res.status(statusCode);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', NO_CACHE);
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Retry-After', '5');
  res.send(unavailablePage());
}

// ============================================================
// HEALTH
// ============================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'Los Angeles California Roleplay Reverse Proxy',
    publicUrl: PUBLIC_URL,
    target: `${TARGET_HOST}:${TARGET_PORT}`,
    oauth: true,
    timestamp: new Date().toISOString()
  });
});

app.get('/healthz', (req, res) => res.status(200).send('ok'));

// ============================================================
// HELPERS
// ============================================================

function removeHopByHopHeaders(headers) {
  delete headers.connection;
  delete headers['keep-alive'];
  delete headers['proxy-authenticate'];
  delete headers['proxy-authorization'];
  delete headers.te;
  delete headers.trailer;
  delete headers['transfer-encoding'];
  delete headers.upgrade;
  return headers;
}

// Rewrite backend redirects (important for Discord OAuth) so users
// never see the backend IP:port, only the public domain.
function rewriteLocation(location) {
  if (!location || typeof location !== 'string') return location;

  if (location.startsWith(TARGET_ORIGIN)) {
    return PUBLIC_URL + location.slice(TARGET_ORIGIN.length);
  }

  if (location.startsWith(TARGET_ORIGIN_HTTPS)) {
    return PUBLIC_URL + location.slice(TARGET_ORIGIN_HTTPS.length);
  }

  if (location.startsWith('/')) {
    return PUBLIC_URL + location;
  }

  return location;
}

// ============================================================
// PROXY REQUEST
// ============================================================

function proxyRequest(req, res) {
  const startTime = Date.now();
  const requestPath = req.originalUrl || req.url;
  const remoteAddress = req.socket.remoteAddress || '';
  const existingForwardedFor = req.headers['x-forwarded-for'];

  const forwardedFor = existingForwardedFor
    ? `${existingForwardedFor}, ${remoteAddress}`
    : remoteAddress;

  const headers = {
    ...req.headers,
    host: `${TARGET_HOST}:${TARGET_PORT}`,
    'x-forwarded-for': forwardedFor,
    'x-real-ip': remoteAddress,
    'x-forwarded-host': PUBLIC_HOST,
    'x-forwarded-proto': 'https',
    'x-forwarded-port': '443',
    'x-forwarded-server': PUBLIC_HOST,
    // HTML is modified below, so the backend must not compress it.
    'accept-encoding': 'identity',
    connection: 'keep-alive'
  };

  // Cookie / Set-Cookie are intentionally untouched (Discord OAuth needs them).

  // Never let the backend answer 304 for HTML we need to rewrite.
  delete headers['if-none-match'];
  delete headers['if-modified-since'];

  removeHopByHopHeaders(headers);

  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: requestPath,
    method: req.method,
    headers,
    agent,
    timeout: 15000
  };

  console.log(
    requestPath.startsWith('/auth/')
      ? `[Proxy] OAuth ${req.method} ${requestPath}`
      : `[Proxy] ${req.method} ${requestPath} -> ${TARGET_HOST}:${TARGET_PORT}`
  );

  const proxy = http.request(options, targetResponse => {
    const statusCode = targetResponse.statusCode || 502;
    const responseHeaders = { ...targetResponse.headers };

    removeHopByHopHeaders(responseHeaders);

    if (responseHeaders.location) {
      responseHeaders.location = rewriteLocation(responseHeaders.location);
    }

    const contentType = String(
      targetResponse.headers['content-type'] || ''
    ).toLowerCase();

    // ---------- HTML: buffer, inject favicon, send ----------
    if (contentType.includes('text/html')) {
      const chunks = [];

      targetResponse.on('data', chunk => chunks.push(chunk));

      targetResponse.on('end', () => {
        if (res.headersSent || res.writableEnded) return;

        try {
          let html = Buffer.concat(chunks).toString('utf8');
          html = injectFavicon(html);

          delete responseHeaders['content-length'];
          delete responseHeaders['content-encoding'];
          delete responseHeaders.etag;
          delete responseHeaders['last-modified'];

          responseHeaders['content-type'] = 'text/html; charset=utf-8';
          responseHeaders['cache-control'] = NO_CACHE;
          responseHeaders.pragma = 'no-cache';
          responseHeaders.expires = '0';

          res.writeHead(statusCode, responseHeaders);
          res.end(html);
        } catch (error) {
          console.error('[Proxy] Failed to process HTML:', error.message);
          sendUnavailable(res, 502);
        }
      });

      targetResponse.on('error', error => {
        console.error('[Proxy] Target HTML response error:', error.message);

        if (!res.headersSent && !res.writableEnded) {
          sendUnavailable(res, 502);
        } else if (!res.writableEnded) {
          res.destroy();
        }
      });

      return;
    }

    // ---------- Everything else: stream straight through ----------
    res.writeHead(statusCode, responseHeaders);

    targetResponse.on('error', error => {
      console.error('[Proxy] Target response error:', error.message);
      if (!res.writableEnded) res.destroy();
    });

    targetResponse.pipe(res);
  });

  proxy.on('timeout', () => {
    console.error(
      `[Proxy] TARGET TIMEOUT: ${TARGET_HOST}:${TARGET_PORT} (${Date.now() - startTime}ms)`
    );

    proxy.destroy();

    if (!res.headersSent && !res.writableEnded) {
      sendUnavailable(res, 503);
    } else if (!res.writableEnded) {
      res.end();
    }
  });

  proxy.on('error', error => {
    console.error(
      `[Proxy] TARGET CONNECTION FAILED: ${error.code || 'UNKNOWN'} - ${error.message}`
    );

    if (res.headersSent) {
      if (!res.writableEnded) res.end();
      return;
    }

    sendUnavailable(res, 503);
  });

  req.on('aborted', () => {
    console.log(`[Proxy] Client aborted ${req.method} ${requestPath}`);
    proxy.destroy();
  });

  res.on('close', () => {
    if (!res.writableEnded) proxy.destroy();
  });

  res.on('finish', () => {
    console.log(
      `[Proxy] ${req.method} ${requestPath} -> ${res.statusCode} (${Date.now() - startTime}ms)`
    );
  });

  req.pipe(proxy);
}

// ============================================================
// FORWARD EVERYTHING
// ============================================================

app.use((req, res) => proxyRequest(req, res));

app.use((error, req, res, next) => {
  console.error('[Proxy] Express error:', error);

  if (res.headersSent) return next(error);

  return sendUnavailable(res, 503);
});

// ============================================================
// START
// ============================================================

const server = app.listen(LISTEN_PORT, HOST, () => {
  console.log('===========================================');
  console.log('   LOS ANGELES CALIFORNIA ROLEPLAY PROXY');
  console.log('===========================================');
  console.log(`Public    : ${PUBLIC_URL}`);
  console.log(`Target    : ${TARGET_ORIGIN}`);
  console.log(`OAuth     : ${PUBLIC_URL}/auth/discord`);
  console.log(`Callback  : ${PUBLIC_URL}/auth/discord/callback`);
  console.log('Health    : /health');
  console.log('Favicon   : /favicon.webp');
  console.log('===========================================');
});

server.on('error', error => {
  console.error('[Proxy] Server error:', error);
});

// ============================================================
// GRACEFUL SHUTDOWN
// ============================================================

function shutdown(signal) {
  console.log(`[Proxy] ${signal} received. Shutting down...`);

  server.close(() => {
    agent.destroy();
    console.log('[Proxy] Server stopped.');
    process.exit(0);
  });

  setTimeout(() => {
    agent.destroy();
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
