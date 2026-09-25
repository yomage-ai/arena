# 测评结果

这里保存 AI 生成作品的归档成品，按「项目 / 模型 / 记录」组织。目前共二十三份作品：**GPT6-Astra-xhigh**、**GPT6-sol-max** 与暂列 **Opus 5.5 · extra** 各五份，**GPT5.6-sol-max** 和 **Doubao-Seed-2.1-pro** 各四份。测试环境中的候鸟、月球车、植物大战僵尸和瓶中沧海暂按此前的 Opus 记录归类，等待确认。候鸟包含六份结果、五个模型；鹈鹕骑自行车和月球车各包含五个模型；植物大战僵尸包含四个模型；瓶中沧海目前收录三个模型。GPT6-Astra 与 GPT5.6 的月球车由各自原工程打包为静态版本；Opus 鹈鹕和月球车的原件与标准 HTML 入口同时保留。

```text
results/
  migration/                       候鸟迁徙
    gpt6-astra-xhigh/import-01/
      index.html
      cover.png
    gpt6-sol-max/import-01/
      index.html
      cover.jpg
    gpt5-6-sol-max/import-01/
      index.html
      cover.jpg
    opus-5-5/import-01/
      index.html
      cover.jpg
    doubao-seed-2-1-pro/import-01/
      index.html
      cover.jpg
    doubao-seed-2-1-pro/import-02/
      index.html
      cover.jpg
  pvz/                             植物大战僵尸
    gpt6-astra-xhigh/import-01/
      index.html
      cover.png
    gpt6-sol-max/import-01/
      index.html
      cover.png
    gpt5-6-sol-max/import-01/
      index.html
      cover.jpg
    opus-5-5/import-01/
      index.html
      cover.jpg
  bicycle/                         鹈鹕骑自行车
    gpt6-astra-xhigh/import-01/
      index.html
      pelican-ride.html
      cover.svg
    gpt6-sol-max/import-01/
      index.html
      cover.jpg
    gpt5-6-sol-max/import-01/
      index.html
      cover.jpg
    opus-5-5/import-01/
      index.html
      pelican-bike.html
      cover.jpg
    doubao-seed-2-1-pro/import-01/
      index.html
      cover.jpg
  bottled-ocean/                   瓶中沧海
    gpt6-astra-xhigh/import-01/
      index.html
      bottle-ocean.html
      cover.png
    gpt6-sol-max/import-01/
      index.html
      bottled-ocean.html
      cover.jpg
    opus-5-5/import-01/
      index.html
      original.html
      cover.jpg
```

GPT6 与 GPT5.6 的月球车目录为 `lunar-rover/gpt6-astra-xhigh/import-01/` 和 `lunar-rover/gpt5-6-sol-max/import-01/`，均包含 `index.html`、`assets/`、`favicon.svg` 和真实场景截图 `cover.jpg`；SOL 版本另含本地字体。Doubao 月球车目录为 `lunar-rover/doubao-seed-2-1-pro/import-01/`，包含原样 HTML 与真实截图；原件运行时从在线 CDN 加载 Three.js 和字体。

GPT6-sol-max 月球车目录为 `lunar-rover/gpt6-sol-max/import-01/`，保留原始 HTML、CSS、JS、本地 Three.js 模块、月壤纹理、许可证和 README，并增加实际场景截图 `cover.jpg`；运行时不需要 CDN。

`lunar-rover/opus-5-5/import-01/` 保留测试环境原项目的九个文件：原 HTML 作为 `original.html` 原样存放，`js/` 中八个模块不改；网站入口 `index.html` 仅补齐文档外壳并添加内嵌 favicon，另有实景封面 `cover.jpg`。这份作品运行时从在线 CDN 加载 Three.js 与字体，断网无法加载三维场景。模型暂按同一测试环境的 Opus 5.5 / extra 记录，待确认。

`import-01` 是归档记录编号，不表示一次生成。鹈鹕的 `index.html` 与 `pelican-ride.html` 内容完全一致，两份都保留，网页只计为一个测评结果。该作品的封面从原件中的 SVG 场景提取，原件内容未改动。

五个项目均已关联用户提供的原始提示词，版本分别为 `migration-v1`、`pvz-v1`、`bicycle-v1`、`lunar-rover-v1`、`bottled-ocean-v1`。鹈鹕提示词中的“你不需要任何测试”作为原文保留；瓶中沧海提示词里的原始拼写及换行也保留。GPT6-Astra 与 GPT5.6-sol 两组配置的推理强度分别记录为 xhigh 和 max；GPT6-sol 五份作品沿用 max，Opus 鹈鹕为 extra；测试环境中的候鸟、月球车、植物大战僵尸和瓶中沧海暂按 Opus extra 收录并注明依据；Doubao 鹈鹕记录为“高”；此前月球车的 gpt6、gpt5.6 简称沿用对应两组配置，并在记录中注明依据。生成日期、轮次及人工干预没有确认的信息继续留空。模型目录 ID 使用小写英文、数字和连字符，因此 GPT5.6-sol-max 的目录名为 `gpt5-6-sol-max`。

月光花园使用工程中已编译好的单 HTML 成品；完整源码、原始美术、中间文件和依赖一并保留在 `source-projects/moon-garden-defense/`，不随静态测评网站发布。

月球车完整工程分别保留在 `source-projects/lunar-explorer/`（GPT6）和 `source-projects/lunar-rover/`（GPT5.6）。收录仅增加静态入口、打包脚本及 SOL 版的本地字体路径适配，原场景与交互组件未改写。打包步骤见 [月球车收录说明](../docs/lunar-rover-import.md)，原件校验见 `artifacts/site/astra-xhigh-lunar-rover-import.json` 和 `artifacts/site/sol-max-lunar-rover-import.json`。

## 添加新的测试结果

1. 将作品放进 `results/<项目ID>/<模型ID>/<记录ID>/`，入口命名为 `index.html`。多文件作品保留资源文件和相对路径；每次生成使用新的记录目录。
2. 可将封面命名为 `cover.png`、`cover.jpg` 或 `cover.svg`，放在同一目录。
3. 编辑 `site/catalog.json`，添加真实模型和结果记录。入口填 `./works/<项目ID>/<模型ID>/<记录ID>/index.html`，封面采用相应的 `./works/.../cover.png` 路径，无封面填 null。
4. 执行 `npm run build:site`，刷新本地网页检查；执行 `npm run package:site` 更新部署包。

构建根据清单自动把已收录记录的整个目录复制到 `site/works/`，不需要修改构建脚本。记录目录内的非隐藏文件都会随网站发布；制作材料和内部备注放在其他目录。

`results/` 是原件，`site/works/` 是发布副本。不要直接修改发布副本。构建遇到内容不同的已有文件会停止，防止覆盖旧记录；新版本应另建记录目录。

网站预览：在项目根目录执行 `npm run serve:site`，访问 `http://127.0.0.1:8776/`。详细字段和发布步骤见 [网站使用说明](../docs/website.md)。初次整理映射见 `artifacts/site/directory-migration.json`；模型目录更名和 SOL 候鸟迁入记录见 `artifacts/site/sol-max-import.json`，SOL 鹈鹕迁入记录见 `artifacts/site/sol-max-bicycle-import.json`，月光花园迁入记录见 `artifacts/site/sol-max-pvz-import.json`，均含原件校验值。

Doubao 候鸟按原文件逐字节迁入，封面为开场实拍截图。开始迁徙后存在渲染异常，清单标记为运行异常；问题与证据见 [检查报告](../docs/doubao-migration-review.md)，未修改生成代码。

Doubao 鹈鹕按原文件逐字节迁入，记录为“推理强度：高”；封面取自实际运行动画。迁入哈希与浏览器检查见 `artifacts/site/doubao-high-bicycle-import.json`。

2026-09-23 收录的另一份 Doubao 候鸟保存在 `migration/doubao-seed-2-1-pro/import-02/`，与旧版 `import-01` 分开。新文件从测试目录逐字节复制，原测试文件仍在原处；其推理强度和生成日期未知。网页在同一模型卡片提供两份结果的切换，新版默认展示。

Doubao 月球车原件从测试目录逐字节移入独立结果目录，使用在线 Three.js 模块运行；具体推理强度和生成日期未知。其封面为实际三维场景截图。

Opus 5.5 鹈鹕从 `测试环境/pelican-bike.html` 迁入 `bicycle/opus-5-5/import-01/pelican-bike.html`，原件逐字节保留。因原文件缺少标准 HTML 文档外壳，另生成仅补齐文档结构的 `index.html` 作为网站入口；动画脚本和画面内容未改。`cover.jpg` 来自实际运行画面，页面会从 Google Fonts 加载字体，断网时使用回退字体。迁入校验与交互检查见 `artifacts/site/opus-5-5-bicycle-import.json`。

GPT6-sol-max 鹈鹕从 `测试环境 2/pelican-bicycle.html` 原样迁入 `bicycle/gpt6-sol-max/import-01/index.html`；没有外部资源。`cover.jpg` 来自实际运行动画。来源与检查见 `artifacts/site/gpt6-sol-max-bicycle-import.json`。

GPT6-sol-max 月球车从 `测试环境 2/` 原样迁入 `lunar-rover/gpt6-sol-max/import-01/`，保留全部 13 个原始文件及相对路径；`cover.jpg` 来自实际运行的三维场景。来源、文件校验及浏览器检查见 `artifacts/site/gpt6-sol-max-lunar-rover-import.json`。

测试环境中的另一份月球车从 `测试环境/lunar-rover/` 迁入 `lunar-rover/opus-5-5/import-01/`；原始九个文件的哈希、网站入口调整与浏览器检查见 `artifacts/site/opus-5-5-lunar-rover-import.json`。

两份新候鸟分别从 `测试环境/migration.html` 和 `测试环境 2/index.html` 原样迁入 `migration/opus-5-5/import-01/`、`migration/gpt6-sol-max/import-01/`，各自配有实际飞行画面封面。来源、哈希和交互检查见 `artifacts/site/new-migration-imports.json`。

GPT6-sol-max 的《植物大战僵尸 · 草坪保卫战》从 `测试环境 2/index.html` 原样复制到 `pvz/gpt6-sol-max/import-01/`，封面取自同目录的桌面游玩截图。源码、构建脚本、测试脚本及原始截图保留在 `source-projects/gpt6-sol-pvz/`，本地重建与归档 HTML 逐字节一致。

暂列 Opus 5.5 · extra 的《植物大战僵尸 · HTML5 复刻版》从 `测试环境/pvz/dist/植物大战僵尸.html` 原样复制到 `pvz/opus-5-5/import-01/`。实际主菜单截图作为封面；源码、构建脚本、全部中间产物和原始成品保留在 `source-projects/opus-5-5-pvz/`，不包含可由锁文件安装的 `node_modules`。模型与思考强度待确认，来源及浏览器检查见 `artifacts/site/opus-5-5-pvz-import.json`。

《瓶中沧海》从 `测试环境 2/bottled-ocean.html` 原样复制到 `bottled-ocean/gpt6-sol-max/import-01/`，原文件名和标准入口逐字节一致。`cover.jpg` 来自实际 WebGL 场景截图。作品依赖在线 Three.js r160 CDN；来源、哈希与浏览器检查见 `artifacts/site/gpt6-sol-max-bottled-ocean-import.json`。

暂列 Opus 5.5 · extra 的《瓶中沧海 · Ship in a Bottle》从 `测试环境/ship-in-bottle/dist/瓶中沧海.html` 原样复制到 `bottled-ocean/opus-5-5/import-01/`。原始中文文件名保留在 `source-projects/opus-5-5-bottled-ocean/`；发布目录用 `original.html` 和标准入口保存相同字节，避免压缩包中的中文文件名兼容问题。11 个工程文件保留，重新构建的 HTML 哈希与原件一致；封面截自实际 WebGL 画面。作品需联网加载 Three.js r160 和 Google Fonts，模型归属待确认；来源及验证见 `artifacts/site/opus-5-5-bottled-ocean-import.json`。

GPT6-Astra-xhigh 的《瓶中沧海 · A Sea of One’s Own》从 `测试环境 2/bottle-ocean.html` 逐字节复制到 `bottled-ocean/gpt6-astra-xhigh/import-01/`，本次模型与思考强度由用户明确确认为 Astra / xhigh。`cover.png` 取自该作品的桌面实景截图；五张原测试截图和检查记录保存在 `source-projects/gpt6-astra-bottled-ocean/artifacts/`。作品依赖在线 Three.js r160 CDN；来源与独立浏览器检查见 `artifacts/site/gpt6-astra-xhigh-bottled-ocean-import.json`。
