import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const sourceDir = resolve(root, 'public/game-source');
const atlasPath = resolve(root, 'public/assets/moon-garden-sprite-atlas.png');
const outputDir = resolve(root, 'dist-single');
const outputPath = resolve(outputDir, '月光花园守卫战.html');

const [html, cssSource, javascript, atlas] = await Promise.all([
  readFile(resolve(sourceDir, 'index.html'), 'utf8'),
  readFile(resolve(sourceDir, 'styles.css'), 'utf8'),
  readFile(resolve(sourceDir, 'game.js'), 'utf8'),
  readFile(atlasPath),
]);

const atlasDataUri = `data:image/png;base64,${atlas.toString('base64')}`;
const css = cssSource.replaceAll("/assets/moon-garden-sprite-atlas.png", atlasDataUri);
const safeJavascript = javascript.replaceAll('</script', '<\\/script');
const bundled = html
  .replace('<link rel="stylesheet" href="styles.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="game.js" defer></script>', `<script>\n${safeJavascript}\n</script>`)
  .replace('  <meta name="theme-color"', '  <!-- 本文件已内嵌全部样式、脚本与图片，可离线运行。 -->\n  <meta name="theme-color"');

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, bundled);
console.log(`Single-file game built: ${outputPath}`);
