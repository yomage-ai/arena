# 收录作品的完整制作工程

这里保留测评结果附带的完整制作材料。测评网页只使用 `results/` 中的归档成品，制作工程不随网站发布。

- `moon-garden-defense/`：GPT5.6-sol-max 的植物大战僵尸测评结果《月光花园守卫战》。整个原目录原样迁入，保留源码、素材、原始美术提示词、中间文件、依赖和原始构建产物。详细说明见其 `README.md`。
- 此次收录的原始单 HTML：`moon-garden-defense/dist-single/月光花园守卫战.html`；对应归档副本：`../results/pvz/gpt5-6-sol-max/import-01/index.html`。
- `lunar-rover/`：GPT5.6-sol-max 的月球车测评《月面巡视器 · LUNA-07》。由“测试环境”完整迁入，包含 React / Three.js 源码、依赖、字体缓存、中间文件和原 Vinext 构建产物。原工程没有独立 HTML，通过外置静态挂载脚本收录为可部署网页；详见 [月球车收录说明](../docs/lunar-rover-import.md)。
- `lunar-explorer/`：GPT6-Astra-xhigh 的月球车测评《SELENE · 月面漫游》。整个原工程目录原样迁入，包含源码、依赖、缓存、中间文件与原构建产物。通过外置静态挂载脚本打包，原组件和编译全局 CSS 未改写。

如继续修改工程并重新构建，请将新结果另存到新的测评记录目录，保留现有归档样本。迁入记录及原件校验值见 `../artifacts/site/sol-max-pvz-import.json`、`../artifacts/site/sol-max-lunar-rover-import.json` 和 `../artifacts/site/astra-xhigh-lunar-rover-import.json`。
