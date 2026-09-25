# Doubao-Seed-2.1-pro 候鸟检查

检查日期：2026-09-20。结论：开场菜单可正常显示，开始迁徙后场景渲染异常。已作为问题样本收录，没有修复或清理原始 HTML。

## 浏览器实测

通过本地站点打开原件，分别选择暖纸和夜航并点击“开始迁徙”。两次均只出现天空背景与控制按钮，未显示鸟群、田野和房屋。控制台反复出现：

```text
TypeError: Cannot read properties of undefined (reading 'wall')
  at palKey (index.html:565)
  at addHouse (index.html:986)
  at drawBackHouses (index.html:1152)
  at frame (index.html:2267)
```

点击“音乐开”后，按钮文字及 active 状态均保持不变。页面的 document.compatMode 实测为 BackCompat；原文件在 DOCTYPE 前包含额外生成说明和 Markdown 标记，主界面虽然遮住了这些内容，但无障碍树仍包含它们。

![启动后异常画面](../artifacts/site/doubao-migration-runtime.jpg)

## 源码定位

1. **渲染中断**：第 462 行的 `hash(a,b,c)` 直接对参数做数值乘法，后续多处使用 `hash(i,'w')`、`hash(i,'y')` 等字符串参数，返回 NaN。散屋位置与尺寸随之失效，`styleAt` 返回无效的调色板索引，在第 565 行读取 wall 时报错。帧函数提前安排下一帧，因此错误持续重复，已排队的场景图元无法完成绘制。
2. **音乐按钮不切换**：第 2165 行回调把当前 active 状态取反作为 muted，随后又用相反值回写 active，结果保留原状态；默认开启时始终无法通过按钮关闭。
3. **气候过渡失效**：第 456 行的 smoothstep 需要三个参数，第 554 行仅传一个，结果为 NaN。隔离执行原函数确认：x=8599 时风格为 0，x=8601 时直接变为 1，插值系数始终为 0。这是静态逻辑确认，未因主场景故障而实际观看完整跨气候旅程。
4. **交付文件结构**：DOCTYPE 前的说明文本使页面进入兼容模式。这不是上述绘制异常的直接原因，但交付文件并非干净的 HTML 文档。
5. **提示词差异**：SoundEngine 使用振荡器实时合成音乐主题，没有按题目提供两首内嵌 base64 配乐。该项属于要求实现差异，不等同于浏览器报错。

仅检查桌面浏览器的开场、两种场景启动、音乐按钮和相关源码；主场景故障使镜头、风场、鸟群、诗句、长时间运行及移动端效果无法完成验收，未做音质评价。

## 归档与网站

- 来源：`/Users/apm30/Documents/project/测试环境/demo_Doubao-Seed-2.1-pro/候鸟.html`
- 归档：`results/migration/doubao-seed-2-1-pro/import-01/index.html`
- 大小：91,939 字节。
- 原件与发布副本 SHA-256：`a86596a17d15a3ef94d1560376a834acb95e52a16ae73e61068477c9e91f6952`。
- 仅移动并重命名入口，内容逐字节不变；开场实拍截图用作 cover.jpg，没有虚构正常飞行画面。
- 网站标记：availability=broken、validation=issues，可打开原始作品并查看已知问题。
- 原错误日志和隔离函数输出在 `artifacts/site/doubao-migration-console.json` 与 `doubao-migration-logic.json`。JSON 中 NaN 序列化为 null，布尔字段明确标记对应计算是否为 NaN。
- 本地清单、发布副本及部署 ZIP 已更新；本次未推送 Git 或部署公网。
