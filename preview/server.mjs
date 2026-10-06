import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 8765);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
 try {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') { res.writeHead(302, { Location: '/preview/index.html' }); res.end(); return; }
  const requested = decodeURIComponent(url.pathname === '/' ? '/preview/index.html' : url.pathname);
  const target = path.resolve(root, '.' + requested);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !types[path.extname(target)]) { res.writeHead(403); res.end('Forbidden'); return; }
  const content = await readFile(target);
  res.writeHead(200, { 'Content-Type': types[path.extname(target)], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(content);
 } catch (_) { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '127.0.0.1', () => process.stdout.write('Orchard preview: http://127.0.0.1:' + port + '\n'));
