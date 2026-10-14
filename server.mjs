// Proxy locale: serve relievum.it da http://localhost:PORT senza X-Frame-Options/CSP
// e inietta inject.js in ogni pagina HTML.
// Avvio: node server.mjs  → apri http://localhost:3000
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TARGET = 'https://relievum.it';
const PORT = Number(process.env.PORT) || 3000;
const DIR = dirname(fileURLToPath(import.meta.url));

// Header di risposta da non inoltrare al browser
const DROP_RESPONSE_HEADERS = new Set([
  'x-frame-options',
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
  'content-encoding', // fetch decomprime già il body
  'content-length',
  'transfer-encoding',
  'connection',
  'alt-svc',
  'link',
]);

// Riscrive URL assoluti del sito target verso il proxy (relativi)
const rewriteUrls = (text) =>
  text
    .replaceAll('https://relievum.it', '')
    .replaceAll('https:\\/\\/relievum.it', '')
    .replaceAll('//relievum.it', '');

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const server = http.createServer(async (req, res) => {
  try {
    // Pagina wrapper con l'iframe
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(await readFile(join(DIR, 'index.html')));
      return;
    }

    // Path della pagina proxata: /site/... → TARGET/...
    const path = req.url.startsWith('/site') ? req.url.slice(5) || '/' : req.url;

    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['accept-encoding'];
    if (headers.origin) headers.origin = TARGET;
    if (headers.referer) headers.referer = TARGET + new URL(headers.referer).pathname.replace(/^\/site/, '');

    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const upstream = await fetch(TARGET + path, {
      method: req.method,
      headers,
      body: hasBody ? await readBody(req) : undefined,
      redirect: 'manual',
    });

    const outHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (DROP_RESPONSE_HEADERS.has(key) || key === 'set-cookie') return;
      outHeaders[key] = key === 'location' ? rewriteUrls(value) : value;
    });
    // Cookie: rimuove Domain così valgono su localhost
    const cookies = upstream.headers.getSetCookie().map((c) => c.replace(/;\s*domain=[^;]+/gi, ''));
    if (cookies.length) outHeaders['set-cookie'] = cookies;

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      const inject = await readFile(join(DIR, 'inject.js'), 'utf8');
      let html = rewriteUrls(await upstream.text());
      const tag = `<script>${inject}</script>`;
      html = html.includes('</head>') ? html.replace('</head>', `${tag}</head>`) : tag + html;
      res.writeHead(upstream.status, outHeaders);
      res.end(html);
      return;
    }

    res.writeHead(upstream.status, outHeaders);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    console.error(req.method, req.url, err);
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Proxy error: ' + err.message);
  }
});

server.listen(PORT, () => console.log(`Proxy attivo su http://localhost:${PORT}`));
