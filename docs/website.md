# AI 试验场 · 使用与发布

正式网站：[https://arena.yomage.com/](https://arena.yomage.com/)。已部署到 `124.221.20.152` 的独立 Nginx 站点，启用 HTTPS；配置与后续发布、回退步骤见 [服务器部署说明](../deploy/README.md)。

第一版已实现项目选择、作品卡片、原始 HTML 独立打开、提示词查看与复制、生成记录、多个 AI 与同一 AI 多次生成的展示、手机布局、地址恢复、空状态和 404 页面。测评首页为纯静态实现；部分 AI 作品原件会从外部 CDN 加载依赖。

当前共五个项目、二十三份归档作品。Doubao-Seed-2.1-pro 模型在 `site/catalog.json` 中设置 `hidden: true`，网页展示 GPT6-Astra-xhigh、GPT6-sol-max、GPT5.6-sol-max 和暂列 Opus 5.5 · extra 的十九份作品；豆包四份作品的记录与原件保留，恢复时把该字段改为 `false` 并重新打包。隐藏会同步影响项目卡片、模型组数、作品计数及无脚本链接；它仅控制页面展示，已知直接作品地址仍可访问。Doubao 旧版候鸟的运行异常详见 [检查报告](doubao-migration-review.md)。Doubao 月球车、测试环境月球车和三份瓶中沧海从在线 CDN 加载 Three.js；GPT6-sol 月球车使用本地 Three.js 和纹理，无需 CDN。同一项目下关联相同提示词版本。GPT6-Astra、GPT6-sol、GPT5.6-sol 和 Opus 5.5 的强度分别记录为 xhigh、max、max、extra；测试环境中的新候鸟、月球车、植物大战僵尸和瓶中沧海的 Opus 归属依据同目录先前结果，仍待确认。五个项目的提示词已按用户原文录入，版本分别为 migration-v1、pvz-v1、bicycle-v1、lunar-rover-v1 和 bottled-ocean-v1，并关联到对应作品；可在页面查看并复制。生成日期、轮次及人工干预尚待补充，未知信息保留 null。候鸟提示词里的重复段落、反斜杠和换行均原样保留；以后精简或改写时另存新版本。

## 本地查看

在项目根目录执行：

```sh
npm run build:site
npm run serve:site
```

浏览器访问 `http://127.0.0.1:8776/`。如端口已占用，可执行 `npm run serve:site -- 8777`。服务只监听本机并提供 `site/` 发布目录，不展示整个工作目录。

作品卡片的封面和“打开作品”按钮会在当前标签页打开结果页面；浏览器后退可回到测评页。应用内浏览器不再依赖新标签页或弹窗。

首页从 `catalog.json` 读取内容，需要通过 HTTP(S) 打开，不能直接双击 `site/index.html`。例如 `/?project=pvz` 可直达植物大战僵尸，刷新、浏览器前进／后退会恢复相应项目。无效 ID 有明确提示并回到已有作品的项目。

原有游戏的 `npm run build`、`npm test` 和 `npm run serve` 仍然保留。

## 目录分工

```text
results/                      测评结果原件（收录入口）
  migration/gpt6-astra-xhigh/import-01/index.html
  migration/gpt6-sol-max/import-01/index.html
  migration/gpt5-6-sol-max/import-01/index.html
  migration/opus-5-5/import-01/index.html
  migration/doubao-seed-2-1-pro/import-01/index.html
  migration/doubao-seed-2-1-pro/import-02/index.html
  pvz/gpt6-astra-xhigh/import-01/index.html
  pvz/gpt6-sol-max/import-01/index.html
  pvz/gpt5-6-sol-max/import-01/index.html
  pvz/opus-5-5/import-01/index.html
  bicycle/gpt6-astra-xhigh/import-01/index.html
  bicycle/gpt6-sol-max/import-01/index.html
  bicycle/gpt5-6-sol-max/import-01/index.html
  bicycle/opus-5-5/import-01/index.html
  bicycle/doubao-seed-2-1-pro/import-01/index.html
  lunar-rover/gpt5-6-sol-max/import-01/index.html
  lunar-rover/gpt6-astra-xhigh/import-01/index.html
  lunar-rover/gpt6-sol-max/import-01/index.html
  lunar-rover/opus-5-5/import-01/index.html
  lunar-rover/doubao-seed-2-1-pro/import-01/index.html
  bottled-ocean/gpt6-astra-xhigh/import-01/index.html
  bottled-ocean/gpt6-sol-max/import-01/index.html
  bottled-ocean/opus-5-5/import-01/index.html
  README.md                   结果目录说明
site/                         可直接发布的完整网站
  index.html                  首页
  catalog.json                项目、模型、提示词与结果清单
  assets/                     首页脚本、样式和图标
  works/                      从 results/ 复制的已收录作品与资源
  404.html                    缺失页面
src/                          植物大战僵尸制作源码
migration-work/               候鸟制作源码与素材
source-projects/              收录作品附带的完整工程（不进入网站发布目录）
  moon-garden-defense/        月光花园源码、素材、中间文件与原始构建产物
  gpt6-sol-pvz/               草坪保卫战源码、构建与测试脚本、原始截图
  opus-5-5-pvz/               HTML5 复刻版源码、构建中间产物、原始成品
  opus-5-5-bottled-ocean/     瓶中沧海工程源码、构建脚本、原始成品
  gpt6-astra-bottled-ocean/  Astra 瓶中沧海的原测试截图和检查记录
scripts/
  build-site.mjs              从 results/ 导入，检查清单与文件
  serve-site.mjs              本地预览服务
  package-site.mjs            生成部署压缩包
artifacts/
  builds/                    重新构建的作品，不覆盖测评原件
  archives/                  历史项目压缩包
  ai-arena-deploy.zip        完整静态网站，index.html 位于压缩包根目录
  site/build-info.json        作品体积与 SHA-256 校验记录
tests/site.test.cjs            清单、路径、版本关系与原件完整性检查
```

原件与封面一并放在各结果目录中。鹈鹕的两个 HTML 内容一致，作为同一条结果保留。首页代码与作品保持独立，作品没有注入导航或修改脚本。`import-01` 只是此次导入的编号，不代表这份作品由 AI 一次生成。

## 新增一个 AI 结果

目前使用文件和清单收录，没有网页上传后台。每次测试完成后，可以将 HTML 放到 `results/` 中并告诉我文件路径，附上下面这些信息，由我整理作品目录、添加卡片和更新部署包；完整多文件作品可提供整个文件夹或 ZIP。

```text
项目：候鸟迁徙 / 植物大战僵尸 / 新项目名称
AI 产品与准确模型版本：按实际使用情况填写
使用的提示词：migration-v1 / pvz-v1 / bicycle-v1 / 新版本原文
生成日期：实际日期
生成记录：第一次生成 / 修复第几版
是否有追问、人工修改：有则附原文或说明
作品位置：HTML、完整文件夹或 ZIP 的路径
截图：可选
测试结论与已知问题：可选，例如页面能打开，但手机操作有问题
```

收录后，同一题目的不同模型会成为并列卡片，同一模型的多次记录出现在下拉选择里。每次结果单独存放，保留旧作品。原始作品能打开但有缺陷时，仍可保留并注明问题；不要先修好再覆盖原始样本。

自行维护时，按下面四步操作：

1. 将完整作品放入 `results/<项目ID>/<模型ID>/<记录ID>/`。单文件作品命名为 `index.html`；多文件作品连同资源一起复制，保留相对路径。
2. 将封面放入同一记录目录，例如 `cover.png`。封面可以设为 null，页面显示“暂无作品封面”。
3. 编辑 `site/catalog.json`，添加模型记录，再复制一条现有结果并填写新的 id、projectId、modelId、entry、cover 与真实生成信息。entry 和 cover 使用 `./works/` 开头的发布路径，每个结果使用不同文件路径。
4. 执行 `npm run build:site` 检查记录和文件，刷新浏览器验收，再生成新部署包。

例如，一份候鸟结果可放在 `results/migration/<模型ID>/run-01/index.html`。清单里将其关联到项目 migration、真实模型 ID 和提示词 migration-v1，entry 填 `./works/migration/<模型ID>/run-01/index.html`。路径中的模型 ID 必须替换为实际英文 ID，不保留尖括号。

执行网站构建后，本地网页读取更新后的清单，刷新即可看到新增结果。已部署的网站还需要执行 `npm run package:site`，将新包重新发布到原站点；只修改本地文件不会自动改变公网版本。若以后接入 Git 自动发布，则按对应流程提交并推送更新。

模型记录格式如下，值为结构示例，应替换为准确记录：

```json
{
  "id": "model-a-v1",
  "label": "AI 产品显示名",
  "product": "实际使用的生成产品",
  "version": "准确模型版本"
}
```

不同模型版本或推理强度使用不同 model ID，以便分别展示；例如 `gpt6-astra-xhigh` 和 `gpt5-6-sol-max`。`models` 数组顺序决定卡片顺序；未关联结果的模型不显示虚构作品卡片。新增项目在 `projects` 数组中添加记录，结果通过 projectId 关联；项目顺序同样由数组决定。

## 补充提示词与生成记录

每个项目的 `promptVersions` 存放固定版本的完整原文。例如：

```json
{
  "id": "migration-v1",
  "label": "提示词 v1",
  "text": "在这里逐字粘贴实际使用的提示词，保留换行和空格。",
  "conditions": "实际共用素材、工具权限与生成预算的说明"
}
```

将项目的 `defaultPromptVersionId` 指向默认版本，并将每份结果的 `promptVersionId` 指向它实际使用的版本。只有项目里有提示词而作品未关联时，该作品的提示词仍显示“待补充”；不会自动认领项目默认版本。

| 字段 | 规则 |
| --- | --- |
| id | 每条记录唯一，使用小写英文、数字和连字符 |
| runLabel | 如“第 1 次生成”“修复第 1 版”；没有证据时保留“现有作品” |
| variant | original 表示一次生成，revised 表示迭代修复，未知用 null |
| parentRunId | 修复来源的结果 id；须绑定相同项目、模型和提示词，原始或未知记录用 null |
| featured | 同一项目、同一模型下默认展示哪次记录；建议只设置一个 true |
| availability | available 已收录可打开；broken 文件存在但运行异常；missing 未收录；failed 生成失败 |
| validation | untested 未验收；passed 已验收；issues 存在问题 |
| generatedAt | 实际生成日期或时间；未知用 null |
| conditions | tools、parameters、budget、intervention 分别记录工具权限、可见参数、预算、人工干预，值为文本或 null |
| notes / knownIssues | 补充说明与问题列表；未记录问题不等于通过测评 |

missing 和 failed 的 entry 必须为 null，不生成失效链接。broken 可打开原始产物，并在卡片上标注“运行异常”。同一 AI 的多个结果会自动出现记录下拉选择，切换后封面、标题、状态、链接和详情同步更新。

提示词原文可以复制；若浏览器禁用自动复制，会选中原文并提示使用系统复制。所有清单文字通过文本节点渲染，提示词中的代码保留为文字。作品入口限制为 `./works/` 下的站内路径。

## 保留原始作品

`results/` 保存测评成品，`site/works/` 保存发布副本。`scripts/build-site.mjs` 根据清单中的 `./works/...` 路径，自动查找 `results/...` 并复制整个记录目录，不需要为每个新作品改构建脚本。目录内非隐藏文件都会发布，制作材料和内部备注应放在其他目录。

如果原交付是工程而非独立网页，完整原工程另存 `source-projects/`，并记录部署所需的适配。月球车保留原组件与样式，仅新增静态挂载入口、打包客户端依赖和调整本地字体路径；步骤见 [月球车收录说明](lunar-rover-import.md)。网站日常构建直接复制已归档静态成品，不需要安装月球车工程的依赖。

构建会对比原件与发布副本的字节；如果已有文件内容不同，构建会停止，避免覆盖已收录的记录。新版本请另存到新的记录目录并添加结果，不直接修改发布副本。

修改首页样式、清单和记录不会修改原始作品。植物大战僵尸的 `npm run build` 输出到 `artifacts/builds/pvz/index.html`；候鸟的 `python3 migration-work/build.py` 输出到 `artifacts/builds/migration/index.html`。重新构建不会覆盖已归档的测评结果，决定收录时再放入新记录目录。

不同路径不隔离浏览器 localStorage。同域部署新增作品时检查其存储 key 是否冲突；需要严格隔离时使用不同来源。

## 生成部署包

```sh
npm run package:site
```

输出 `artifacts/ai-arena-deploy.zip`。包内只有 `site/` 网站内容，没有设计文档、源码制作材料、测试文件或本地配置。每次打包从当前目录重新创建压缩包，不保留上次包中已删除的文件。

可将此包交给静态托管平台，或将 `site/` 内的内容放到已有服务器的网站根目录。默认按域名根目录发布；首页和作品链接为相对路径，如部署到子路径，需要同时将 `404.html` 的首页链接从 `/` 调整到该子路径。

Cloudflare Pages 支持普通静态 HTML 与直接上传预制文件，可按其[静态 HTML 文档](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/)和[直接上传文档](https://developers.cloudflare.com/pages/get-started/direct-upload/)发布。后续使用 Git 自动发布时，可将构建命令设为 `npm run build:site`，发布目录设为 `site`，并确保仓库含构建所需的源文件与封面。Git 集成与直接上传在创建项目时分别选择。

上线后从实际域名检查首页、作品链接、图片、手机横屏与存档。目录存在的检查不能替代每个新作品的人工功能验收。

## 验证

```sh
npm run build:site
npm test
```

自动检查覆盖现有原件的字节一致性、发布文件存在、非法项目回退、新增 AI 和多次记录、提示词关联、不可用状态与修复关系。浏览器实测记录见 `artifacts/site/validation.md`。

当前网站已可本地运行，并部署到正式域名；部署包为 `artifacts/ai-arena-deploy.zip`。需要继续补充的是实际生成产品、生成日期、轮次与人工干预；补齐后更新清单并按服务器部署流程发布即可。
