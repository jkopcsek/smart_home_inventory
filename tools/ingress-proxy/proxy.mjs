/**
 * Simulates Home Assistant Ingress for local testing:
 * mounts the app (backend on :8099, serving the built frontend) under
 *   http://localhost:8100/api/hassio_ingress/faketoken/
 * stripping the prefix like real Ingress does and forwarding X-Ingress-Path.
 *
 * Run:  node tools/ingress-proxy/proxy.mjs
 * Then open http://localhost:8100/ (iframe test page, like HA renders it).
 */
import http from 'node:http';

const TARGET = process.env.TARGET ?? 'http://localhost:8099';
const PREFIX = '/api/hassio_ingress/faketoken';
const PORT = 8100;

const server = http.createServer((req, res) => {
  if (!req.url.startsWith(PREFIX)) {
    // Anything outside the prefix behaves like the HA frontend page.
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html>
<html><head><title>Ingress test harness</title></head>
<body style="margin:0;font-family:sans-serif">
<div style="background:#03a9f4;color:#fff;padding:8px 16px">Fake HA chrome — app below runs in an iframe under ${PREFIX}/</div>
<iframe src="${PREFIX}/" style="border:0;width:100%;height:calc(100vh - 40px)"></iframe>
</body></html>`);
    return;
  }
  const strippedPath = req.url.slice(PREFIX.length) || '/';
  const target = new URL(strippedPath, TARGET);
  const proxied = http.request(
    target,
    {
      method: req.method,
      headers: { ...req.headers, 'x-ingress-path': PREFIX, host: target.host },
    },
    (upstream) => {
      res.writeHead(upstream.statusCode ?? 502, upstream.headers);
      upstream.pipe(res);
    }
  );
  proxied.on('error', (err) => {
    res.writeHead(502);
    res.end(`upstream error: ${err.message}`);
  });
  req.pipe(proxied);
});

server.listen(PORT, () => {
  console.log(`Ingress simulation: http://localhost:${PORT}/  →  ${TARGET}`);
  console.log(`App under prefix:   http://localhost:${PORT}${PREFIX}/`);
});
