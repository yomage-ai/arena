# 测评结果

这里保存 AI 生成作品的归档成品，按「项目 / 模型 / 记录」组织。目前共八份作品：**GPT6-Astra-xhigh** 和 **GPT5.6-sol-max** 各四份。四个项目各包含两个模型的结果。两份月球车是从各自原始工程打包的静态版本，其余成品按原件收录。

```text
results/
  migration/                       候鸟迁徙
    gpt6-astra-xhigh/import-01/
      index.html
      cover.png
    gpt5-6-sol-max/import-01/
      index.html
      cover.jpg
  pvz/                             植物大战僵尸
    gpt6-astra-xhigh/import-01/
      index.html
      cover.png
    gpt5-6-sol-max/import-01/
      index.html
      cover.jpg
  bicycle/                         鹈鹕骑自行车
    gpt6-astra-xhigh/import-01/
      index.html
      pelican-ride.html
      cover.svg
    gpt5-6-sol-max/import-01/
      index.html
      cover.jpg
```

月球车目录为 `lunar-rover/gpt6-astra-xhigh/import-01/` 和 `lunar-rover/gpt5-6-sol-max/import-01/`，均包含 `index.html`、`assets/`、`favicon.svg` 和真实场景截图 `cover.jpg`；SOL 版本另含本地字体。

`import-01` 是归档记录编号，不表示一次生成。鹈鹕的 `index.html` 与 `pelican-ride.html` 内容完全一致，两份都保留，网页只计为一个测评结果。该作品的封面从原件中的 SVG 场景提取，原件内容未改动。

四个项目均已关联用户提供的原始提示词，版本分别为 `migration-v1`、`pvz-v1`、`bicycle-v1`、`lunar-rover-v1`。鹈鹕提示词中的“你不需要任何测试”作为原文保留。两组配置的推理强度分别记录为 xhigh 和 max；月球车的 gpt6、gpt5.6 简称沿用此前两组配置，并在记录中注明依据。生成日期、轮次及人工干预没有确认的信息继续留空。模型目录 ID 使用小写英文、数字和连字符，因此 GPT5.6-sol-max 的目录名为 `gpt5-6-sol-max`。

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
