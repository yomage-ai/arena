// Concatenate src/*.js into the template → dist/瓶中沧海.html (single self-contained page; three.js r160 from CDN)
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const src = join(root, 'src');
const parts = (await readdir(src)).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
let code = '';
for (const f of parts) code += `\n// ───────────────────────── ${f} ─────────────────────────\n` + (await readFile(join(src, f), 'utf8'));
const tpl = await readFile(join(src, 'template.html'), 'utf8');
const html = tpl.replace('/*@@CODE@@*/', () => code);
await mkdir(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', '瓶中沧海.html');
await writeFile(out, html);
console.log(`built ${out}  (${(html.length / 1024).toFixed(1)} KB, ${parts.length} modules)`);
