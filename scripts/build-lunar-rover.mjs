// Static mount adapter for the archived client-only scene. Never rewrite its source.
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'source-projects/lunar-rover');
const output = path.join(root, 'artifacts/builds/lunar-rover/site');
const requireSource = createRequire(path.join(source, 'package.json'));
const { build } = requireSource('esbuild');
await mkdir(path.join(output, 'assets'), { recursive: true });

const bundle = await build({
  absWorkingDir: source,
  stdin: {
    contents: `import { createRoot } from 'react-dom/client';
import LunarExperience from './components/lunar-experience';
createRoot(document.getElementById('root')).render(<LunarExperience />);`,
    loader: 'tsx',
    resolveDir: source,
    sourcefile: 'static-mount.tsx',
  },
  alias: { '@': source },
  bundle: true,
  platform: 'browser',
  format: 'esm',
  jsx: 'automatic',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  legalComments: 'linked',
  metafile: true,
  outfile: path.join(output, 'assets/app.js'),
});

// Reuse the original compiled styles and cached fonts; only relocate font URLs.
const cssDir = path.join(source, 'dist/client/_next/static/css');
const cssFiles = (await readdir(cssDir)).filter(name => name.endsWith('.css'));
if (cssFiles.length !== 1) throw new Error('Expected the archived build to have one global stylesheet.');
await cp(path.join(cssDir, cssFiles[0]), path.join(output, 'assets/style.css'));
let fontStyles = '';
const fontsDir = path.join(source, '.vinext/fonts');
for (const family of (await readdir(fontsDir)).sort()) {
  const directory = path.join(fontsDir, family);
  const css = await readFile(path.join(directory, 'style.css'), 'utf8');
  fontStyles += css.replace(/url\(([^)]+)\)/g, (_, original) => {
    const filename = path.basename(original.replace(/^['"]|['"]$/g, ''));
    return `url(./fonts/${family}/${filename})`;
  }) + '\n';
  for (const filename of await readdir(directory)) {
    if (!filename.endsWith('.woff2')) continue;
    await mkdir(path.join(output, 'assets/fonts', family), { recursive: true });
    await cp(path.join(directory, filename), path.join(output, 'assets/fonts', family, filename));
  }
}
fontStyles += `body { --font-geist-sans: 'Geist', Arial, Helvetica, sans-serif; --font-geist-mono: 'Geist Mono', monospace; }\n`;
await writeFile(path.join(output, 'assets/fonts.css'), fontStyles);
await cp(path.join(source, 'public/favicon.svg'), path.join(output, 'favicon.svg'));
await writeFile(path.join(output, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="在可自由浏览的三维月面中观察 LUNA-07 探测车缓慢行驶。">
  <title>月面巡视器 · LUNA-07</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./assets/fonts.css">
  <link rel="stylesheet" href="./assets/style.css">
  <script type="module" src="./assets/app.js"></script>
</head>
<body class="antialiased"><div id="root"></div></body>
</html>
`);
await writeFile(path.join(output, '../bundle-meta.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
console.log(`Static lunar rover built: ${output}\nOriginal scene, UI components and global stylesheet preserved.`);
