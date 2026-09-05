import { readFile, writeFile, mkdir, stat, access, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog } from '../site/assets/catalog-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const results = path.join(root, 'results');
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const catalog = validateCatalog(JSON.parse(await readFile(path.join(site, 'catalog.json'), 'utf8')));

async function copyResultDirectory(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const incomingPath = path.join(source, entry.name);
    const outputPath = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Result directories must contain real files, not symlinks: ${incomingPath}`);
    if (entry.isDirectory()) {
      await copyResultDirectory(incomingPath, outputPath);
    } else if (entry.isFile()) {
      const incoming = await readFile(incomingPath);
      let existing;
      try { existing = await readFile(outputPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing && !existing.equals(incoming)) throw new Error(`${outputPath} already has different content. Preserve this result and use a new record directory for the changed output.`);
      if (!existing) await writeFile(outputPath, incoming);
    }
  }
}

const outputs = [];
for (const result of catalog.results) {
  if (!result.entry) continue;
  const relativeEntry = result.entry.slice('./works/'.length);
  const source = path.join(results, relativeEntry);
  await access(source);
  await copyResultDirectory(path.dirname(source), path.dirname(path.join(site, result.entry)));
  if (result.cover) await access(path.join(site, result.cover));
  const file = path.join(site, result.entry);
  const contents = await readFile(file);
  if (!(await stat(file)).isFile()) throw new Error(`Missing work: ${result.entry}`);
  if (!/<html\b/i.test(contents.toString('utf8'))) throw new Error(`Not an HTML document: ${result.entry}`);
  outputs.push({ id: result.id, source: path.relative(root, source), entry: result.entry, bytes: contents.byteLength, sha256: digest(contents) });
}
for (const result of catalog.results) if (result.cover) await access(path.join(site, result.cover));
for (const file of ['index.html', '404.html', 'assets/app.js', 'assets/catalog-core.mjs', 'assets/style.css', 'assets/favicon.svg']) await access(path.join(site, file));
await mkdir(path.join(root, 'artifacts', 'site'), { recursive: true });
await writeFile(path.join(root, 'artifacts', 'site', 'build-info.json'), JSON.stringify({ builtAt: new Date().toISOString(), projects: catalog.projects.length, results: catalog.results.length, outputs }, null, 2) + '\n');
console.log(`Site ready: ${site}`);
console.log(`${catalog.projects.length} projects, ${outputs.length} HTML works; originals preserved byte for byte.`);
