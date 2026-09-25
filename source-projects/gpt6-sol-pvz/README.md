# 植物大战僵尸 · 草坪保卫战

直接在浏览器打开 index.html，无需联网或安装依赖。

## 操作

- 点击植物卡片，再点击草坪种植；按数字 1–7 也可以选卡。
- 点击阳光收集；点击铲子或按 0 / X 可铲除植物。
- 空格暂停或继续，M 切换声音；页面底部可切换 1× / 2× 速度。
- 守住五波进攻即可获胜；每行的割草机只能使用一次。

## 源码与构建

- src/index.template.html：页面结构
- src/styles.css：界面样式
- src/game.js：绘制、动画、交互、音效和游戏规则
- scripts/build.py：将源码合并为单个 index.html
- scripts/smoke-test.cjs：浏览器交互与截图检查（需要 Playwright）
- artifacts/：测试时保留的桌面和手机截图

需要重新构建时运行 python3 scripts/build.py。以上制作文件都保留在目录中。
