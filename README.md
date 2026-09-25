# AI 试验场 · AI 作品测评站

正式网站：[arena.yomage.com](https://arena.yomage.com/)。已部署到指定 Ubuntu 服务器，配置和更新说明见 [服务器部署说明](deploy/README.md)。

网站入口在 `site/`，已归档候鸟迁徙、植物大战僵尸、鹈鹕骑自行车、月球车、瓶中沧海五个项目，共二十三份作品：**GPT6-Astra-xhigh**、**GPT6-sol-max** 与暂列 **Opus 5.5 · extra** 各五份，**GPT5.6-sol-max** 和 **Doubao-Seed-2.1-pro** 各四份。测试环境中的候鸟、月球车、植物大战僵尸和瓶中沧海暂按该目录此前的 Opus 记录归类，模型归属仍待用户确认。豆包模型暂时隐藏，网页目前展示十九份作品；归档文件仍保留。豆包候鸟的两次独立收录和月球车、鹈鹕记录均可在需要时恢复展示。同一项目下的结果关联相同提示词版本。测评结果统一存放在 [`results/`](results/README.md)，按「项目 / 模型 / 记录」归档。GPT6-Astra 与 GPT5.6 的月球车由各自原工程打包为静态网页，完整源码与打包说明见 [月球车收录说明](docs/lunar-rover-import.md)。GPT6-sol 和暂列 Opus 5.5 的植物大战僵尸完整工程分别保留在 [`source-projects/gpt6-sol-pvz/`](source-projects/gpt6-sol-pvz/README.md) 和 [`source-projects/opus-5-5-pvz/`](source-projects/opus-5-5-pvz/README.md)；暂列 Opus 的瓶中沧海工程保留在 [`source-projects/opus-5-5-bottled-ocean/`](source-projects/opus-5-5-bottled-ocean/build.mjs)。三份瓶中沧海原件均通过 Three.js r160 CDN 加载三维场景，需联网。执行 `npm run build:site`，再执行 `npm run serve:site`，访问 `http://127.0.0.1:8776/`。

网站的作品收录、提示词／模型记录、发布步骤见 [网站使用说明](docs/website.md)。`npm run package:site` 生成 `artifacts/ai-arena-deploy.zip`。原有游戏源码与命令继续保留。

## 从 Git 仓库运行

```sh
git clone https://github.com/yomage-ai/arena.git
cd arena
npm run build:site
npm test
npm run serve:site
```

测评站本身不需要安装 npm 依赖。`results/` 内的 23 份作品及资源纳入版本管理，`site/works/` 由构建恢复。完整制作源码、素材、提示词和部署配置也在仓库中；依赖、运行缓存、本机托管配置、重复构建输出及 ZIP 包保留在本地，不提交。两个静态打包脚本依赖的原编译 CSS 和字体单独保留为固定构建输入。

## 目录导航

| 目录 | 用途 |
| --- | --- |
| `results/` | 测评结果原件，新增作品放这里 |
| `site/` | 网站首页、作品清单与可发布副本；`site/works/` 由构建生成 |
| `src/` | 植物大战僵尸制作源码 |
| `migration-work/` | 候鸟制作源码、音乐和检查工具 |
| `source-projects/` | 收录作品附带的完整制作工程，包括月光花园、月球车及其中间文件 |
| `scripts/` | 网站构建、预览和打包工具 |
| `deploy/` | 线上 Nginx 配置、部署与 HTTPS 续期说明 |
| `tests/` | 游戏与网站自动检查 |
| `docs/` | 使用说明与历史设计方案 |
| `artifacts/` | 部署包、验证记录与截图；`builds/` 存重新构建的作品，`archives/` 存旧项目压缩包 |

下面是原有游戏说明。

# 植物大战僵尸 · 晴日庭院

一个明亮、手绘风格的《植物大战僵尸》致敬小游戏。已归档游戏文件是 [`results/pvz/gpt6-astra-xhigh/import-01/index.html`](results/pvz/gpt6-astra-xhigh/import-01/index.html)；全部 CSS、JavaScript、程序绘制的画面和合成音效均封装于其中，没有外部资源、CDN、联网请求或安装步骤。

## 开始游玩

直接用现代 Chrome、Edge、Safari 或 Firefox 打开 `results/pvz/gpt6-astra-xhigh/import-01/index.html`，点击「开始守卫」。可离线运行，推荐电脑或手机横屏。

- 点击金色阳光收集，每个价值 25 阳光。
- 点击植物卡片，再点击空草坪种植。
- `1–8` 选择植物，`E` 使用铲子，`Space` 暂停/继续，`Esc` 或右键取消选择。
- 冒险模式共 6 波、61 只僵尸；清理完最后一波即通关。
- 无尽模式会持续生成波次，第 7 波起生命值逐渐增长。
- 五条路各有一台一次性割草机。割草机耗尽后再次被突破就会失败。
- 设置中可以调整声音、音乐、战斗特效与自动收集阳光。
- 支持 1× / 2× 速度、全屏、暂停、图鉴、战绩及续玩。

开局提供 250 阳光、一颗向日葵和一颗豌豆射手。建议先把向日葵布置在左侧，再逐条补齐射手，最后在前排放置坚果。

## 植物小队

| 植物 | 阳光 | 能力 |
|---|---:|---|
| 向日葵 | 50 | 每 12 秒产生阳光 |
| 豌豆射手 | 100 | 持续远程攻击 |
| 坚果墙 | 50 | 2800 生命值的防线 |
| 寒冰射手 | 175 | 命中减速 50%，持续 4 秒 |
| 樱桃炸弹 | 150 | 种下 1 秒后对周围 3×3 格区域造成 1800 伤害 |
| 双发射手 | 200 | 每轮连续发射两颗豌豆 |
| 土豆地雷 | 25 | 8 秒准备后触发近距离爆炸 |
| 大嘴花 | 150 | 吞掉前方一只僵尸，消化 16 秒 |

僵尸包括普通、路障、铁桶、橄榄球和旗帜五种。护甲损坏会改变外观，寒冰会改变角色颜色和移动速度。

## 保留的文件

- `results/pvz/gpt6-astra-xhigh/import-01/index.html`：可以单独复制、传输和游玩的最终成品。
- `src/index.html`：页面模板。
- `src/style.css`：全部界面样式与响应式布局。
- `src/engine.js`：独立于界面的战斗与存档逻辑。
- `src/art.js`：手工编写的 Canvas 场景与角色绘制。
- `src/audio.js`：Web Audio 音乐、打击音与交互音效。
- `src/app.js`：界面控制、动画、输入和运行循环。
- `build.mjs`：无依赖单文件构建脚本。
- `tests/`：战斗及打包测试。
- `artifacts/`：构建信息、测试结果、浏览器验收记录和中间/最终截图。

## 构建与测试

只需要 Node.js；没有 npm 依赖需要安装。

```sh
npm run build
npm test
```

构建产物输出到 `artifacts/builds/pvz/index.html`，不会覆盖已归档的测评结果。也可执行 `npm run serve`，访问 `http://127.0.0.1:8765/artifacts/builds/pvz/index.html` 预览新构建。预览服务仅为开发便利，最终 HTML 不依赖服务器。

程序以 60Hz 固定步长计算战斗，用 requestAnimationFrame 绘制。静态背景预绘制缓存，实体采用独立的时间驱动动画；种子卡肖像在运行时绘制并转为内存中的 PNG 数据。音乐与音效由 Web Audio 合成，不使用音频文件。

## 存档说明

每 5 秒、主动暂停或离开页面时尝试保存。存档和偏好保存在当前浏览器本地，不上传任何信息；更换浏览器、网址、移动 HTML 文件或清理浏览数据可能导致旧存档不可见。浏览器禁用本地存储时仍可游玩，但无法续存。

这是独立编写的致敬版本，使用自行绘制的矢量角色和场景，不是原版素材移植。
