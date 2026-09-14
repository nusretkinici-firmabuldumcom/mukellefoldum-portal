import http from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT || 4174);
const ofisBase = (process.env.OFIS_INTERNAL_URL || '').replace(/\/$/, '');
const internalKey = process.env.INTERNAL_KEY || '';
const appHost = process.env.APP_HOST || '';
if (!ofisBase || !internalKey) {
  console.error('OFIS_INTERNAL_URL ve INTERNAL_KEY ortam değişkenleri zorunlu.');
  process.exit(1);
}

// GET paths served locally from ./dist — everything else (all /api/* calls,
// login/logout, and any role-based redirect target) is proxied to the ofis
// service's internal portal API. This service owns no data of its own: firms,
// documents and portal/session state all live on the ofis side, in the SAME
// data folder the advisor 'ofis' app already uses.
const files = {
  '/': 'landing.html',
  '/tanitim': 'landing.html',
  '/landing.css': 'landing.css',
  '/landing.js': 'landing.js',
  '/giris': 'login.html',
  '/login.js': 'login.js',
  '/portal.css': 'portal.css',
  '/mukellefoldum': 'taxpayer.html',
  '/kolaymukellef': 'taxpayer.html',
  '/taxpayer.js': 'taxpayer.js',
  '/startup-ui.js': 'startup-ui.js',
  '/startup-ui.css': 'startup-ui.css',
  '/advisor-startup.js': 'advisor-startup.js',
  '/upload-categories.js': 'upload-categories.js',
  '/upload-categories.css': 'upload-categories.css',
};
const types = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8' };

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

async function readBody(req, max) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw Error('Dosya boyutu sınırı aşıldı.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;
  if (path === '/health' && req.method === 'GET') { json(res, 200, { status: 'ok' }); return; }

  const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`, process.env.RAILWAY_PUBLIC_DOMAIN, appHost].filter(Boolean);
  if (!allowedHosts.includes(req.headers.host)) { json(res, 403, { error: 'Geçersiz adres.' }); return; }

  try {
    const file = files[path];
    if (file && req.method === 'GET') {
      const content = await readFile(new URL('./dist/' + file, import.meta.url));
      res.writeHead(200, { 'Content-Type': types[file.split('.').pop()], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(content);
      return;
    }

    // Proxy everything else to the ofis service's gated internal portal API.
    const target = ofisBase + '/internal/portal' + path + url.search;
    const headers = { 'X-Internal-Key': internalKey };
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.cookie) headers['Cookie'] = req.headers.cookie;
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: hasBody ? await readBody(req, 20 * 1024 * 1024) : undefined,
      redirect: 'manual',
    });
    const resHeaders = {};
    for (const [key, value] of upstream.headers) {
      if (['content-encoding', 'transfer-encoding', 'connection', 'set-cookie'].includes(key)) continue;
      resHeaders[key] = value;
    }
    const setCookies = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : [];
    if (setCookies.length) resHeaders['set-cookie'] = setCookies;
    res.writeHead(upstream.status, resHeaders);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    json(res, 502, { error: 'Ofis servisine ulaşılamadı. Birazdan yeniden dene.' });
  }
}).listen(port, '0.0.0.0', () => console.log('mukellefoldum portal servisi ' + port + ' portunda hazır'));
