/**
 * Minimal static file server for the end-to-end tests. It serves `dist/` the way a plain web
 * host would: directory URLs resolve to index.html and unknown paths get 404.html with a 404.
 *
 * Pass a mount point to serve the build under a sub-path, the way a project site or a personal
 * web directory is hosted. Requests outside the mount point get a bare 404.
 *
 * Usage: node tests/serve.mjs <port> [mount point, for example /~jjcorso]
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.argv[2] ?? 4399);
const mount = (process.argv[3] ?? '').replace(/\/+$/, '');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  if (!pathname.startsWith(`${mount}/`)) {
    response.writeHead(404, { 'content-type': types['.txt'] });
    response.end('Not found');
    return;
  }
  const relative = normalize(pathname.slice(mount.length)).replace(/^[/\\]+/, '');
  let file = join(root, relative);
  // Never serve anything outside dist/.
  if (file !== root && !file.startsWith(`${root}/`)) file = root;
  if (pathname.endsWith('/')) file = join(file, 'index.html');

  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    const body = await readFile(join(root, '404.html')).catch(() => 'Not found');
    response.writeHead(404, { 'content-type': types['.html'] });
    response.end(body);
  }
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}${mount}/`));
