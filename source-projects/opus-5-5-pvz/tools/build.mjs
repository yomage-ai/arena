// 构建脚本：把 src/ 下的 ES 模块打包、压缩，并内联进单个 HTML 文件。
// 中间产物全部保留在 build/ 目录：
//   build/bundle.js        未压缩的打包结果（便于阅读 / 调试）
//   build/bundle.js.map    对应的 sourcemap
//   build/bundle.min.js    压缩后的脚本
//   build/style.min.css    压缩后的样式
//   build/meta.json        esbuild 依赖分析
//   build/report.json      体积与耗时报告
// 最终产物：dist/植物大战僵尸.html（完全自包含，可离线双击打开）
import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = join(root, 'src');
const buildDir = join(root, 'build');
const distDir = join(root, 'dist');
const t0 = Date.now();

await mkdir(buildDir, { recursive: true });
await mkdir(distDir, { recursive: true });

// 1) 未压缩打包（保留可读性）
const dev = await esbuild.build({
  entryPoints: [join(src, 'main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: join(buildDir, 'bundle.js'),
  sourcemap: true,
  metafile: true,
  legalComments: 'none',
  logLevel: 'warning',
});
await writeFile(join(buildDir, 'meta.json'), JSON.stringify(dev.metafile, null, 2));

// 2) 压缩版本
await esbuild.build({
  entryPoints: [join(src, 'main.js')],
  bundle: true,
  format: 'iife',
  target: ['es2020'],
  outfile: join(buildDir, 'bundle.min.js'),
  minify: true,
  legalComments: 'none',
  define: { 'DEBUG_BUILD': 'false' },
  logLevel: 'warning',
});

// 3) CSS 压缩
const cssRes = await esbuild.transform(await readFile(join(src, 'style.css'), 'utf8'), { loader: 'css', minify: true });
await writeFile(join(buildDir, 'style.min.css'), cssRes.code);

// 4) 内联进 HTML 模板
const js = (await readFile(join(buildDir, 'bundle.min.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
let html = await readFile(join(src, 'index.html'), 'utf8');
html = html.replace(/<link[^>]+href="style\.css"[^>]*>/, () => `<style>${cssRes.code}</style>`);
html = html.replace(/<script type="module" src="main\.js"><\/script>/, () => `<script>${js}</script>`);
html = html.replace(/<!--DEV-ONLY-->[\s\S]*?<!--\/DEV-ONLY-->/g, '');
const outFile = join(distDir, '植物大战僵尸.html');
await writeFile(outFile, html);

const kb = n => (n / 1024).toFixed(1) + ' KB';
const report = {
  builtAt: new Date().toISOString(),
  ms: Date.now() - t0,
  modules: Object.keys(dev.metafile.inputs).length,
  bundle: kb((await readFile(join(buildDir, 'bundle.js'))).length),
  bundleMin: kb(js.length),
  html: kb(Buffer.byteLength(html)),
  output: 'dist/植物大战僵尸.html',
};
await writeFile(join(buildDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('构建完成', report);
