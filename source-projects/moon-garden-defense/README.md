# 月光花园守卫战

原创美术的单机浏览器塔防小游戏。最终交付文件位于 `dist-single/月光花园守卫战.html`，样式、脚本和 PNG 精灵图均已内嵌，断网环境也能直接双击运行。

## 操作

- 点击植物卡牌，再点击草坪种植。
- 点击掉落的阳光收集资源。
- 右键、Shift + 点击或双击已有植物可铲除。
- 数字键 1—6 选择卡牌，空格暂停，Escape 取消选择。
- 顶部可切换 1× / 2× 游戏速度和音效。

## 保留的源文件与中间文件

- `public/game-source/index.html`：结构源文件
- `public/game-source/styles.css`：完整视觉与动效
- `public/game-source/game.js`：完整游戏逻辑
- `public/assets/moon-garden-sprite-atlas.png`：运行时精灵图集
- `src-intermediate/moon-garden-sprite-atlas-original.png`：原始生成图集
- `src-intermediate/art-prompts.md`：美术生成提示词记录
- `scripts/build-single.mjs`：单文件编译脚本

## 开发与编译

```bash
npm run dev
npm run build:single
```
