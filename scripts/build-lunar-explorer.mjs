// Static mount adapter for the archived GPT6 scene; source files stay unchanged.
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'source-projects/lunar-explorer');
const output = path.join(root, 'artifacts/builds/lunar-explorer/site');
const { build } = createRequire(path.join(source, 'package.json'))('esbuild');
await mkdir(path.join(output, 'assets'), { recursive: true });

const bundle = await build({
  absWorkingDir: source,
  stdin: {
    contents: `import { createRoot } from 'react-dom/client';
import Home from './app/page';
createRoot(document.getElementById('root')).render(<Home />);`,
    loader: 'tsx', resolveDir: source, sourcefile: 'static-mount.tsx',
  },
  alias: { '@': source },
  bundle: true, platform: 'browser', format: 'esm', jsx: 'automatic',
  target: ['es2020'], define: { 'process.env.NODE_ENV': '"production"' },
  minify: true, legalComments: 'linked', metafile: true,
  outfile: path.join(output, 'assets/app.js'),
});

const cssDir = path.join(source, 'dist/client/_next/static/css');
const styles = (await readdir(cssDir)).filter(name => name.endsWith('.css'));
if (styles.length !== 1) throw new Error('Expected one archived global stylesheet.');
await cp(path.join(cssDir, styles[0]), path.join(output, 'assets/style.css'));
await cp(path.join(source, 'public/favicon.svg'), path.join(output, 'favicon.svg'));
await writeFile(path.join(output, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="在真实光影的立体月面中，跟随玉衡号探测车缓慢巡航。自由旋转、缩放与探索。">
  <title>SELENE · 月面漫游</title>
  <link rel="icon" href="./favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="./assets/style.css">
  <script type="module" src="./assets/app.js"></script>
</head>
<body><div id="root"></div></body>
</html>
`);
await writeFile(path.join(output, '../bundle-meta.json'), JSON.stringify(bundle.metafile, null, 2) + '\n');
console.log(`Static SELENE built: ${output}\nOriginal scene, UI and compiled global stylesheet preserved.`);
