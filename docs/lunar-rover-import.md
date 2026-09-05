# 月球车收录说明

“月球车”已收录 GPT5.6 的《月面巡视器 · LUNA-07》和 GPT6 的《SELENE · 月面漫游》，分别沿用此前 GPT5.6-sol-max、GPT6-Astra-xhigh 配置，原话与配置依据已记录在清单中。两份结果均关联原文提示词 `lunar-rover-v1`：

> 创建一个网页，中间是一辆高精度、充满细节、极度写实的月面探测车 3D 模型，并且探测车在同样精细真实的月球表面上缓慢行驶，背景为太空，环境并不是二维静态的，可以通过鼠标进行缩放、旋转和自由浏览。

## GPT5.6 保存位置

- 完整原工程：`source-projects/lunar-rover/`，由 `/Users/apm30/Documents/project/测试环境` 当时的全部 22 个顶层项目迁入；源码、依赖、缓存、中间文件、原构建产物均保留。
- 归档静态成品：`results/lunar-rover/gpt5-6-sol-max/import-01/`。
- 网站发布副本：`site/works/lunar-rover/gpt5-6-sol-max/import-01/`。
- 收录与校验记录：`artifacts/site/sol-max-lunar-rover-import.json`。

## GPT5.6 静态打包的范围

原交付使用 React、Three.js、React Three Fiber 和 Vinext，没有独立 HTML 入口；其 `dist/client` 也不能直接作为静态网站打开。本次通过外置的 `scripts/build-lunar-rover.mjs` 加入一个静态 React 挂载入口，将原 `LunarExperience` 组件及客户端依赖打包为本地脚本。原场景、模型、运动、交互和 UI 组件没有改写。

全局 CSS 直接复用原 `dist/client` 中的编译文件，字节不变。字体复用原 `.vinext/fonts` 缓存，字体文件不变；字体 CSS 中的绝对路径改为相对路径，并在新 HTML 中恢复原布局使用的字体变量和 `antialiased` 类。入口 HTML、脚本包和字体路径适配是本次收录时新增的部署材料，不冒充原工程已有的单 HTML。

成品是包含本地脚本、样式和字体的多文件静态网页。需整目录部署，通过 HTTP(S) 浏览；运行时不需要 Node.js、Vinext 或 Cloudflare Worker。封面直接截自静态作品的实际三维场景。

## GPT5.6 重新打包

保留工程现有依赖时，在测评项目根目录执行：

```sh
node scripts/build-lunar-rover.mjs
```

输出为 `artifacts/builds/lunar-rover/site/`，构建依赖清单为相邻的 `bundle-meta.json`。脚本不修改原工程，也不覆盖已有测评记录；若以后修改作品并收录，应创建新的记录目录。

## GPT6 保存位置与静态打包

完整原工程由 `/Users/apm30/Documents/project/测试环境/lunar-explorer` 整体迁入 `source-projects/lunar-explorer/`。目录设备与 inode 保持一致，源码、依赖、缓存、中间文件和历史构建产物均保留。收录前后对 140 个源文件和构建文件核验 SHA-256。迁入和产物校验见 `artifacts/site/astra-xhigh-lunar-rover-import.json`。

原交付同样是 React / Three.js / Vinext 工程，没有独立静态 HTML。外置脚本仅新增 HTML 和 React 挂载入口，将原 `app/page.tsx`、`app/scene.ts` 及客户端依赖打包为本地 JavaScript，并逐字节复用原编译全局 CSS 和 favicon。未改写探测车、场景、动画或交互代码，也不需要远程字体与模型资源。

归档目录为 `results/lunar-rover/gpt6-astra-xhigh/import-01/`，对应发布副本为 `site/works/lunar-rover/gpt6-astra-xhigh/import-01/`。包含入口、脚本及许可说明、样式、图标和实际三维页面截图封面，需整目录通过 HTTP(S) 部署。

保留原工程依赖时，可重新打包：

```sh
node scripts/build-lunar-explorer.mjs
```

输出为 `artifacts/builds/lunar-explorer/site/`，依赖构建清单为相邻的 `bundle-meta.json`，不覆盖原工程和现有测评归档。

日常更新测评网站仍执行 `npm run build:site` 和 `npm run package:site`，不必重新编译月球车。生成日期、轮次、生成过程中的人工干预未知，继续留空。收录检查只确认发布、显示和基本交互，不等同于已完成写实度、性能或提示词符合度的正式测评。
