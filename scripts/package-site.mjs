import './build-site.mjs';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'ai-benchmark-package-'));
const archive = path.join(temporary, 'ai-arena-deploy.zip');
try {
  execFileSync('/usr/bin/zip', ['-q', '-r', archive, '.', '-x', '.*', '*/.*'], { cwd: path.join(root, 'site') });
  const target = path.join(root, 'artifacts', 'ai-arena-deploy.zip');
  await rename(archive, target);
  console.log(`Deployable archive: ${target}`);
} finally { await rm(temporary, { recursive: true, force: true }); }
