import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const site = await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../site'));
const port = Number(process.argv[2] || 8776);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Provide a valid port number.');
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8', '.woff2': 'font/woff2' };
const inSite = candidate => candidate === site || candidate.startsWith(site + path.sep);
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    const decoded = decodeURIComponent(url.pathname);
    const parts = decoded.split('/');
    if (parts.some(part => part.startsWith('.')) || decoded.includes('\\')) {
      res.writeHead(404).end();
      return;
    }
    let filename = path.resolve(site, '.' + decoded);
    if (!inSite(filename)) { res.writeHead(404).end(); return; }
    if ((await stat(filename)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
      filename = path.join(filename, 'index.html');
    }
    filename = await realpath(filename);
    if (!inSite(filename)) { res.writeHead(404).end(); return; }
    const contents = await readFile(filename);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filename).toLowerCase()] || 'application/octet-stream', 'Content-Length': contents.byteLength, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    if (error instanceof URIError) { res.writeHead(400).end(); return; }
    const contents = await readFile(path.join(site, '404.html'));
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : contents);
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${port}/\nServing only the site/ publishing directory.`));
