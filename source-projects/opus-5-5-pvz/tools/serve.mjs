// 开发用静态服务器：/ 映射到 src/（直接加载 ES 模块），/dist/ 映射到构建产物。
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.map': 'application/json',
};
// 开发调试：页面可 POST 截图（dataURL）到 /__shot?name=xx，保存为 PNG 便于检查高清画面
const shotDir = process.env.SHOT_DIR || join(tmpdir(), 'pvz-shots');
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (req.method === 'POST' && p === '/__shot') {
    const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'shot').replace(/[^\w-]/g, '');
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const data = Buffer.concat(chunks).toString().replace(/^data:image\/png;base64,/, '');
    await mkdir(shotDir, { recursive: true });
    const file = join(shotDir, name + '.png');
    await writeFile(file, Buffer.from(data, 'base64'));
    res.writeHead(200, { 'Content-Type': 'text/plain' }).end(file);
    return;
  }
  let base = join(root, 'src');
  if (p.startsWith('/dist/')) { base = join(root, 'dist'); p = p.slice(5); }
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(base, p));
  if (!file.startsWith(base)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(process.env.PORT || 8940, () => console.log('PvZ dev server: http://localhost:' + (process.env.PORT || 8940)));
