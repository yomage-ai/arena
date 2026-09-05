"""Rebuild the offline design reader from design.md and existing preview images."""
from pathlib import Path
import base64
import html
import json
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def inline(value):
    parts = re.split(r'(`[^`]+`|\[[^\]]+\]\([^)]+\))', value)
    result = []
    for part in parts:
        if part.startswith('`') and part.endswith('`'):
            result.append('<code>' + html.escape(part[1:-1]) + '</code>')
        elif re.fullmatch(r'\[[^\]]+\]\([^)]+\)', part):
            label, url = re.fullmatch(r'\[([^\]]+)\]\(([^)]+)\)', part).groups()
            result.append(f'<a href="{html.escape(url, quote=True)}">{html.escape(label)}</a>')
        else:
            result.append(re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html.escape(part)))
    return ''.join(result)


def markdown(source):
    lines = source.splitlines()
    result, i = [], 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if line.startswith('```'):
            language = line[3:]
            block = []
            i += 1
            while i < len(lines) and not lines[i].startswith('```'):
                block.append(lines[i])
                i += 1
            result.append('<div class="code-label">' + (language.upper() or '建议目录') + '</div><pre><code>' + html.escape('\n'.join(block)) + '</code></pre>')
        elif line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip('|').split('|')]
                if not all(re.fullmatch(r':?-+:?', c) for c in cells):
                    rows.append(cells)
                i += 1
            head = '<thead><tr>' + ''.join('<th scope="col">' + inline(c) + '</th>' for c in rows[0]) + '</tr></thead>'
            body = '<tbody>' + ''.join('<tr>' + ''.join('<td>' + inline(c) + '</td>' for c in row) + '</tr>' for row in rows[1:]) + '</tbody>'
            result.append('<div class="table-wrap" tabindex="0" aria-label="可横向滚动的说明表格"><table>' + head + body + '</table></div>')
            continue
        elif line.startswith('### '):
            result.append('<h3>' + inline(line[4:]) + '</h3>')
        else:
            result.append('<p>' + inline(line) + '</p>')
        i += 1
    return '\n'.join(result)


def picture(path):
    return 'data:image/png;base64,' + base64.b64encode((ROOT / path).read_bytes()).decode()


projects = {
    'migration': {
        'title': '候鸟迁徙', 'tag': '交互场景', 'count': 1,
        'summary': '从同一道迁徙题目，观察场景、运动与交互的不同解法。',
        'focus': '考察点建议：迁徙表达 / 动画连续性 / 交互反馈',
        'entry': '../../../results/migration/gpt6-astra-xhigh/import-01/index.html',
        'image': picture('artifacts/migration/cover-final.png'),
        'note': '已发现独立 HTML。模型、原始提示词与生成轮次待补。',
    },
    'pvz': {
        'title': '植物大战僵尸', 'tag': '交互游戏', 'count': 1,
        'summary': '体验同一款塔防题目，检查玩法是否形成完整的游戏过程。',
        'focus': '考察点建议：种植与战斗 / 胜负闭环 / 操作反馈',
        'entry': '../../../results/pvz/gpt6-astra-xhigh/import-01/index.html',
        'image': picture('artifacts/desktop-final.png'),
        'note': '已发现独立 HTML。模型、原始提示词与生成轮次待补。',
    },
    'bicycle': {
        'title': '自行车动效', 'tag': '题目待定', 'count': 0,
        'summary': '为简单 HTML 动效保留一个项目入口，准确需求待补充。',
        'focus': '考察点建议：运动关系 / 节奏控制 / 画面呈现',
        'entry': None, 'image': None,
        'note': '当前目录未发现这道题的作品；可先建立项目，再逐个收录结果。',
    },
}

prototype = '''
<figure class="prototype" aria-label="首页交互原型">
  <figcaption><span class="eyebrow">可操作原型</span><span>切换项目，打开现有作品 · AI A / B 为占位</span></figcaption>
  <div class="app-top"><div class="brand"><b class="brand-mark">同</b><strong>同题实验室</strong></div><a href="#section-3">测评规则 ↗</a></div>
  <div class="app-grid">
    <nav class="projects" aria-label="选择测评项目">
      <span class="small-title">测评项目</span>
      <button type="button" data-project="migration" aria-pressed="true"><span>01</span><span>候鸟迁徙<small>1 份现有作品</small></span></button>
      <button type="button" data-project="pvz" aria-pressed="false"><span>02</span><span>植物大战僵尸<small>1 份现有作品</small></span></button>
      <button type="button" data-project="bicycle" aria-pressed="false"><span>03</span><span>自行车动效<small>尚未收录</small></span></button>
      <p class="project-foot">相同题目<br>看见不同的解法。</p>
    </nav>
    <div class="results">
      <p class="selection-notice" id="selection-notice" role="status" hidden></p>
      <div class="project-heading"><div><span class="eyebrow" id="project-tag">交互场景</span><h3 id="project-title">候鸟迁徙</h3></div><span id="result-count" class="count-pill">已收录 1 份</span></div>
      <p id="project-summary">从同一道迁徙题目，观察场景、运动与交互的不同解法。</p>
      <p id="project-focus" class="focus-line">考察点建议：迁徙表达 / 动画连续性 / 交互反馈</p>
      <button type="button" class="text-button" id="prompt-toggle" aria-expanded="false" aria-controls="prompt-panel">查看提示词记录 ＋</button>
      <div id="prompt-panel" class="detail-panel" hidden><strong>原始提示词待补</strong><p>当前文件没有提供可确认的原始提示词记录。上方考察点是设计建议，不能替代历史原文。正式收录后，此处展示固定版本的完整提示词与共用素材。</p></div>
      <div id="cards" class="cards">
        <article class="result-card available"><img id="work-image" src="__MIGRATION_IMAGE__" alt="候鸟迁徙现有作品截图"><div class="card-content"><div class="card-heading"><h4>现有作品</h4><span class="status-label">来源待补</span></div><p id="work-note">已发现独立 HTML。模型、原始提示词与生成轮次待补。</p><a id="work-link" class="open-work" href="../../../results/migration/gpt6-astra-xhigh/import-01/index.html" target="_blank" rel="noopener">打开作品 ↗</a><button type="button" id="record-toggle" class="text-button" aria-expanded="false" aria-controls="record-panel">查看生成记录</button></div></article>
        <article class="result-card pending"><div class="placeholder"><span>A</span><small>等待作品</small></div><div class="card-content"><div class="card-heading"><h4>AI A</h4><span class="status-label">占位</span></div><p>收录后展示准确模型版本、作品封面与独立入口。</p><button type="button" disabled>未收录</button></div></article>
        <article class="result-card pending"><div class="placeholder"><span>B</span><small>等待作品</small></div><div class="card-content"><div class="card-heading"><h4>AI B</h4><span class="status-label">占位</span></div><p>使用同一提示词版本；生成条件随作品一并记录。</p><button type="button" disabled>未收录</button></div></article>
      </div>
      <div id="empty-state" class="empty-state" hidden><span class="empty-symbol" aria-hidden="true">＋</span><h4>这道题还没有作品</h4><p>先补充准确题目和统一提示词，再收录各个 AI 的生成结果。</p><button type="button" id="back-available">查看已有项目 →</button></div>
      <div id="record-panel" class="detail-panel" hidden><strong>生成记录 · 来源待补</strong><dl><div><dt>项目</dt><dd id="record-project">候鸟迁徙</dd></div><div><dt>模型版本</dt><dd>未记录</dd></div><div><dt>提示词版本</dt><dd>未记录</dd></div><div><dt>生成日期 / 轮次</dt><dd>未记录</dd></div><div><dt>原始版 / 修复版</dt><dd>待确认</dd></div><div><dt>正式同题结论</dt><dd>补齐记录后再纳入</dd></div></dl></div>
      <p class="prototype-note">原型采用现有文件与截图，未对 AI 结果打分。打开作品会进入新标签页。</p>
    </div>
  </div>
</figure>
<div class="mechanism"><span class="eyebrow">选择如何变成一次跳转</span><div class="flow"><div><small>01 / 首页</small><strong id="flow-project">选择候鸟迁徙</strong></div><span aria-hidden="true">→</span><div><small>02 / 清单</small><strong id="flow-result">找到 1 份现有作品</strong></div><span aria-hidden="true">→</span><div><small>03 / 体验</small><strong id="flow-open">新标签页打开 HTML</strong></div></div><p id="flow-caption" aria-live="polite">当前项目有独立文件入口；没有收录的模型不产生作品链接。</p></div>
'''.replace('__MIGRATION_IMAGE__', projects['migration']['image'])

ia = '''<figure class="ia"><figcaption class="eyebrow">页面结构与返回路径</figcaption><div class="ia-root">测评首页</div><div class="ia-branches"><div><strong>项目与结果</strong><span>切换项目 → AI 结果卡片</span><b>↓</b><strong>独立 HTML 作品</strong><span>新标签页体验 → 返回首页换一个 AI</span></div><div><strong>提示词与生成记录</strong><span>当前页展开，体验前可直接查阅</span></div><div><strong>测评规则</strong><span>共用条件、轮次与评价方法</span></div></div></figure>'''

source = (HERE / 'design.md').read_text()
sections = re.split(r'^## (.+)$', source, flags=re.MULTILINE)
articles = []
for i in range(1, len(sections), 2):
    number = (i + 1) // 2
    title = sections[i]
    content = markdown(sections[i + 1])
    if number == 2:
        end_first_p = content.index('</p>') + 4
        content = content[:end_first_p] + prototype + content[end_first_p:] + ia
    articles.append(f'<section id="section-{number}"><div class="section-label">PART {number:02}</div><h2>{html.escape(title[3:])}</h2>{content}</section>')

css = '''
:root{--ink:#263a34;--muted:#62736c;--accent:#346e59;--line:#dce1d8;--paper:#f6f7f1;--soft:#edf2e8;--white:#fff;--mono:ui-monospace,SFMono-Regular,Consolas,monospace}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.85 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif}a{color:var(--accent);text-underline-offset:4px}button,input{font:inherit}button,a{touch-action:manipulation}button{cursor:pointer}button:focus-visible,a:focus-visible,summary:focus-visible,[tabindex]:focus-visible{outline:3px solid #8baf8e;outline-offset:4px}button:disabled{cursor:default}button:disabled:hover{transform:none}[hidden]{display:none!important}p{margin:16px 0;color:#40564c}strong{font-weight:650}h1,h2,h3,h4{line-height:1.3;letter-spacing:-.035em}h2{font-size:32px;margin:8px 0 26px}h3{font-size:22px;margin:38px 0 12px}h4{font-size:16px;margin:0}code{font:12px/1.8 var(--mono);background:#eaf0e6;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}pre{overflow:auto;margin:0 0 24px;background:#223b32;color:#e9f2e5;padding:23px 26px;border-radius:0 0 12px 12px}pre code{padding:0;background:transparent;color:inherit;white-space:pre;overflow-wrap:normal}.code-label{border-radius:12px 12px 0 0;background:#1b3028;color:#bed3b8;font:11px/2 var(--mono);padding:10px 26px;margin-top:24px;letter-spacing:1px}.table-wrap{overflow:auto;margin:24px 0;border:1px solid var(--line);border-radius:12px;background:var(--white)}table{width:100%;border-collapse:collapse;text-align:left;font-size:14px}th{background:#edf1e9;font-size:12px;color:#51664c}td,th{padding:14px 18px;border-bottom:1px solid var(--line);vertical-align:top}td:first-child{color:var(--ink);font-weight:600;min-width:115px}tr:last-child td{border-bottom:0}.skip-link{position:fixed;top:-100px;left:20px;background:white;padding:10px;z-index:20}.skip-link:focus{top:10px}.layout{display:grid;grid-template-columns:210px minmax(0,1fr);max-width:1540px;margin:auto;gap:48px;padding:0 56px 0 30px}.rail{position:sticky;top:0;height:100vh;padding:36px 12px;display:flex;flex-direction:column;border-right:1px solid var(--line)}.rail-logo{display:flex;align-items:center;gap:10px;font-weight:650;font-size:16px;line-height:1.4}.rail-logo small{display:block;color:var(--muted);font:10px/1.8 var(--mono);letter-spacing:1.2px}.brand-mark{display:inline-flex;width:33px;height:33px;align-items:center;justify-content:center;background:var(--ink);color:#eef4dc;border-radius:8px;font-size:17px}.rail nav{display:grid;gap:8px;margin-top:65px}.rail nav a{text-decoration:none;color:var(--muted);font-size:13px;padding:9px 9px;border-radius:6px}.rail nav a:hover{background:#e5eddf;color:var(--ink)}.rail nav a span{font:11px var(--mono);display:inline-block;width:28px;opacity:.7}.rail-end{margin-top:auto;color:var(--muted);font-size:11px}.rail-end a{display:inline-block;margin-top:10px}.document{min-width:0}.hero{padding:68px 0 52px;border-bottom:1px solid var(--line);position:relative}.eyebrow,.section-label{font-size:10px;letter-spacing:1.5px;font-weight:650;text-transform:uppercase;color:var(--accent)}.hero .eyebrow{display:flex;align-items:center;gap:12px}.hero .eyebrow:before{content:"";height:1px;width:32px;background:var(--accent)}.hero h1{font-size:clamp(40px,4.6vw,72px);letter-spacing:-.065em;font-weight:650;margin:24px 0}.hero h1 span{color:var(--accent)}.hero>p{max-width:720px;font-size:17px;color:#52685b;line-height:1.95}.hero-meta{display:flex;gap:28px;flex-wrap:wrap;margin-top:30px;font-size:12px;color:var(--muted)}.hero-actions{display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin-top:30px}.primary-link{padding:10px 18px;background:var(--ink);color:white!important;border-radius:8px;text-decoration:none;font-size:13px}.quiet-link{font-size:13px}.overview{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;padding:28px 0;border-bottom:1px solid var(--line)}.overview strong{display:block;font-size:17px}.overview small{color:var(--muted);font-size:12px}section{padding:54px 0 12px;border-bottom:1px solid var(--line)}section>p{max-width:880px}.prototype{margin:30px 0;border:1px solid #cad6c8;border-radius:14px;overflow:hidden;background:white;box-shadow:0 16px 55px #17311c0b}.prototype figcaption{background:#e8eee2;padding:11px 18px;display:flex;align-items:center;justify-content:space-between;gap:15px;font-size:10px;color:#51694e}.app-top{padding:17px 23px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;font-size:14px}.brand-mark{flex:none}.app-top a{font-size:11px;text-decoration:none}.app-grid{display:grid;grid-template-columns:173px minmax(0,1fr)}.projects{padding:25px 12px;background:#f9faf6;border-right:1px solid var(--line)}.small-title{color:#7a8778;font-size:10px;letter-spacing:2px;padding-left:12px}.projects button{display:flex;gap:11px;align-items:flex-start;text-align:left;border:1px solid transparent;background:transparent;color:#53654f;font-size:12px;width:100%;padding:13px 10px;border-radius:8px;margin-top:10px;line-height:1.5}.projects button>span:first-child{font:10px/1.8 var(--mono);color:#81927d}.projects button[aria-pressed="true"]{background:#e7efde;border-color:#d7e4c8;color:#28442a}.projects button:hover{background:#eef3e8}.projects button small{display:block;font-size:10px;margin-top:5px;color:#71836a}.project-foot{padding:15px 10px;color:#9aab90;font-size:11px;line-height:2}.results{padding:26px;min-width:0}.project-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.project-heading h3{margin:7px 0;font-size:25px}.project-heading .eyebrow{font-size:9px}.count-pill{border:1px solid #dbe6d3;color:#668059;background:#f7faef;border-radius:20px;font-size:10px;white-space:nowrap;padding:3px 10px}.results>p{font-size:12px;line-height:1.8;margin:10px 0}.results .focus-line{font-size:10px;color:#758771}.text-button{border:0;background:transparent;color:var(--accent);font-size:11px;padding:8px 0;text-align:left}.text-button:hover{text-decoration:underline;text-underline-offset:4px}.cards{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:12px;margin-top:18px}.result-card{border:1px solid #dce3d7;border-radius:9px;overflow:hidden;display:flex;flex-direction:column;min-width:0;background:#fff}.result-card img{display:block;width:100%;aspect-ratio:1.6;object-fit:cover}.card-content{padding:13px;display:flex;flex-direction:column;flex:1;gap:12px}.card-heading{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.card-heading h4{font-size:13px}.status-label{font-size:8px;color:#7c765d;background:#f3f0e7;border-radius:3px;padding:1px 5px}.card-content p{font-size:10px;line-height:1.9;color:#7a8576;margin:0}.open-work{margin-top:auto;font-size:11px;display:block;padding:7px 9px;background:#2f5942;color:white;border-radius:5px;text-decoration:none;text-align:center}.card-content .text-button{margin:-8px 0 -5px;text-align:center}.placeholder{background:repeating-linear-gradient(135deg,#fafbf7,#fafbf7 8px,#f2f4ee 8px,#f2f4ee 9px);aspect-ratio:1.6;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#9aab92}.placeholder span{font:34px/1.1 Georgia,serif;opacity:.6}.placeholder small{font-size:9px;margin-top:8px}.pending button{margin-top:auto;border:1px solid #e4e9dd;background:#f5f7f1;color:#7f8a77;border-radius:5px;padding:6px;font-size:11px}.prototype-note{font-size:9px!important;color:#85907d!important;margin-top:15px!important}.detail-panel{padding:18px;background:#f4f7ef;border:1px solid #dfe8d5;border-radius:7px;font-size:12px;margin:10px 0}.detail-panel p{font-size:12px;margin-bottom:0}.detail-panel dl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;font-size:11px;margin-bottom:0}.detail-panel dl div{border-top:1px solid #dbe3d3;padding-top:10px}.detail-panel dt{color:#819174}.detail-panel dd{margin:3px 0 0}.empty-state{border:1px dashed #cad7bf;background:#fafcf6;text-align:center;border-radius:8px;margin:20px 0;padding:35px 15px}.empty-symbol{display:block;color:#9aaf8e;font-size:24px;margin-bottom:10px}.empty-state h4{font-size:17px}.empty-state p{font-size:11px;color:#7c8e71}.empty-state button{background:#2f5942;color:white;border:0;border-radius:6px;padding:8px 16px;font-size:12px}.selection-notice{padding:9px;background:#fbf1d8;color:#705f39}.mechanism{border-left:3px solid #6c8860;background:#ebf0e4;padding:22px 26px;margin:28px 0 34px}.flow{display:grid;grid-template-columns:1fr 26px 1fr 26px 1fr;gap:8px;align-items:center;margin-top:17px}.flow small{display:block;font:10px/2 var(--mono);color:#829176}.flow strong{font-size:13px}.flow>span{color:#8fa17c}.mechanism p{font-size:12px;margin:14px 0 0;color:#677b5b}.ia{margin:32px 0;padding:28px 26px;border:1px solid var(--line);border-radius:12px}.ia-root{border-radius:6px;background:#304a3d;color:white;width:140px;text-align:center;padding:9px;margin:20px auto 0;font-size:13px}.ia-branches{display:grid;grid-template-columns:1.3fr 1fr 1fr;position:relative;gap:18px;padding-top:28px}.ia-branches:before{content:"";position:absolute;left:17%;right:15%;height:17px;border-top:1px solid #b4c5a9;top:14px}.ia-branches>div{position:relative;text-align:center;border:1px solid #d9e3d2;background:#fcfdf8;padding:16px;border-radius:7px}.ia-branches>div:before{content:"";position:absolute;top:-15px;height:14px;border-left:1px solid #b4c5a9;left:50%}.ia-branches strong,.ia-branches span,.ia-branches b{display:block}.ia-branches strong{font-size:13px}.ia-branches span{font-size:11px;color:#778b6c;margin-top:6px}.ia-branches b{color:#8f9e82;margin:5px 0;font-weight:400}footer{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:32px 0 45px;font-size:11px;color:var(--muted)}noscript p{padding:12px;background:#f9eed5}
@media(min-width:1450px){.results{padding:32px}.cards{gap:16px}.card-content{padding:17px}.card-content p{font-size:11px}.result-card h4{font-size:14px}}
@media(max-width:1150px){.layout{grid-template-columns:165px minmax(0,1fr);gap:26px;padding:0 25px 0 18px}.rail{padding-left:0}.app-grid{grid-template-columns:145px minmax(0,1fr)}.results{padding:20px}.cards{grid-template-columns:1fr 1fr}.available{grid-column:span 2;display:grid;grid-template-columns:1fr 1fr}.available img{height:100%;aspect-ratio:auto;min-height:180px;object-fit:cover}.available .card-content{padding:20px}.pending .placeholder{aspect-ratio:2.8}.card-content p{font-size:11px}.project-heading h3{font-size:23px}}
@media(max-width:800px){.layout{display:block;padding:0 24px}.rail{position:static;height:auto;padding:20px 0;border:0;border-bottom:1px solid var(--line);display:flex;flex-direction:row;justify-content:space-between;align-items:center}.rail nav{display:none}.rail-end{margin:0}.rail-end span{display:none}.hero{padding-top:40px}.hero h1{font-size:49px}.hero>p{font-size:16px}.overview{gap:18px}.overview strong{font-size:14px}h2{font-size:28px}section{padding-top:40px}.ia-branches{gap:10px}.ia-branches>div{padding:12px}.prototype figcaption{align-items:flex-start;flex-direction:column;gap:3px}.flow strong{font-size:12px}}
@media(max-width:570px){.layout{padding:0 18px}.hero h1{font-size:39px}.hero-meta{gap:10px 20px}.overview{grid-template-columns:1fr;gap:14px}.overview>div{display:flex;justify-content:space-between;gap:14px}.hero-actions{gap:16px}.app-grid{display:block}.projects{display:flex;align-items:stretch;padding:10px 8px;gap:5px;border-right:0;border-bottom:1px solid var(--line);overflow-x:auto}.projects .small-title,.project-foot{display:none}.projects button{width:auto;flex:1;min-width:90px;margin:0;padding:10px 7px;font-size:10px;gap:5px}.projects button>span:first-child{display:none}.projects button small{font-size:8px}.app-top{padding:14px 16px}.results{padding:20px 14px}.project-heading h3{font-size:25px}.cards{grid-template-columns:1fr}.available{display:flex;grid-column:auto}.available img{min-height:0;aspect-ratio:1.6;object-fit:cover}.card-content{padding:16px}.available .card-content{padding:16px}.card-heading h4{font-size:15px}.card-content p{font-size:12px}.open-work{font-size:13px;padding:9px}.pending .placeholder{aspect-ratio:3.7}.pending button,.card-content .text-button{font-size:12px}.status-label{font-size:10px}.mechanism{padding:20px 18px}.flow{grid-template-columns:1fr;gap:8px}.flow>span{transform:rotate(90deg);width:16px}.flow strong{font-size:14px}.ia{padding:20px 14px}.ia-branches{grid-template-columns:1fr;padding-top:24px;gap:14px}.ia-branches:before{display:none}.ia-branches>div:not(:first-child):before{display:none}td,th{padding:12px;font-size:12px}td{min-width:155px}.table-wrap{border-radius:8px}.detail-panel dl{grid-template-columns:1fr}.rail-logo{font-size:14px}.rail-end{font-size:10px}.hero>p{font-size:15px}pre{padding:18px}h2{font-size:26px}.project-heading{align-items:flex-start}footer{display:block}footer a{display:inline-block;margin-top:10px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{.layout{display:block;padding:0}.rail,.hero-actions,.prototype button{display:none}body{background:white;font-size:11pt}.hero{padding-top:0}section{break-before:auto}.table-wrap{overflow:visible}a{color:inherit}pre{white-space:pre-wrap}.prototype,.mechanism,.ia{break-inside:avoid}footer{padding-bottom:0}}
'''

script = '''
const projects = __PROJECT_DATA__;
const byId = id => document.getElementById(id);
function closePanels(){
  for(const name of ['prompt','record']){
    byId(name+'-panel').hidden = true;
    byId(name+'-toggle').setAttribute('aria-expanded','false');
  }
}
function renderProject(id){
  const p = projects[id];
  for(const button of document.querySelectorAll('[data-project]')) button.setAttribute('aria-pressed',String(button.dataset.project===id));
  byId('project-title').textContent=p.title;
  byId('project-tag').textContent=p.tag;
  byId('result-count').textContent='已收录 '+p.count+' 份';
  byId('project-summary').textContent=p.summary;
  byId('project-focus').textContent=p.focus;
  byId('record-project').textContent=p.title;
  byId('work-note').textContent=p.note;
  byId('cards').hidden=!p.entry;
  byId('empty-state').hidden=!!p.entry;
  if(p.entry){
    byId('work-link').setAttribute('href',p.entry);
    byId('work-image').src=p.image;
    byId('work-image').alt=p.title+'现有作品截图';
  }else{
    byId('work-link').removeAttribute('href');
  }
  byId('flow-project').textContent='选择'+p.title;
  byId('flow-result').textContent=p.count?'找到 '+p.count+' 份现有作品':'没有可用结果';
  byId('flow-open').textContent=p.count?'新标签页打开 HTML':'显示空状态';
  byId('flow-caption').textContent=p.count?'当前项目有独立文件入口；没有收录的模型不产生作品链接。':'当前项目没有作品，停留在首页并说明原因，不跳转到缺失文件。';
  closePanels();
}
function selectProject(id){
  const url=new URL(location.href);
  url.searchParams.set('project',id);
  try{history.pushState({},'',url);}catch{}
  byId('selection-notice').hidden=true;
  renderProject(id);
}
function restoreProject(){
  const requested=new URL(location.href).searchParams.get('project');
  const valid=requested===null || Object.hasOwn(projects,requested);
  const id=valid && requested?requested:'migration';
  renderProject(id);
  byId('selection-notice').hidden=valid;
  byId('selection-notice').textContent=valid?'':'未找到指定项目，已展示候鸟迁徙。';
}
for(const button of document.querySelectorAll('[data-project]')) button.addEventListener('click',()=>selectProject(button.dataset.project));
byId('back-available').addEventListener('click',()=>{selectProject('migration');document.querySelector('[data-project="migration"]').focus();});
for(const name of ['prompt','record']) byId(name+'-toggle').addEventListener('click',()=>{
  const panel=byId(name+'-panel');
  panel.hidden=!panel.hidden;
  byId(name+'-toggle').setAttribute('aria-expanded',String(!panel.hidden));
});
window.addEventListener('popstate',restoreProject);
restoreProject();
'''.replace('__PROJECT_DATA__', json.dumps(projects, ensure_ascii=False).replace('</', '<\\/'))

page = '''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>同题实验室 · AI 作品测评站设计方案</title><style>__STYLE__</style></head>
<body><a class="skip-link" href="#main">跳到设计正文</a><div class="layout">
<aside class="rail"><div class="rail-logo"><b class="brand-mark">同</b><div>同题实验室<small>SAME PROMPT, MANY IDEAS</small></div></div><nav aria-label="设计文档目录"><a href="#section-1"><span>01</span>价值与范围</a><a href="#section-2"><span>02</span>页面与交互</a><a href="#section-3"><span>03</span>测评如何可追溯</a><a href="#section-4"><span>04</span>实现与发布</a><a href="#section-5"><span>05</span>分阶段落地</a><a href="#section-6"><span>06</span>验收与待补资料</a></nav><div class="rail-end"><span>DESIGN NOTE / 001<br>v1.0 · 2026.09.05<br></span><a href="design.md">阅读 Markdown ↗</a></div></aside>
<main id="main" class="document"><header class="hero"><div class="eyebrow">AI BENCHMARK / PRODUCT DESIGN</div><h1>同一道题，<br><span>看见 AI 的不同解法。</span></h1><p>把候鸟迁徙、植物大战僵尸和更多 HTML 作品，收进一个能直接体验的测评站。选择项目，打开不同 AI 的结果；每份作品都有可查的提示词与生成记录。</p><div class="hero-meta"><span>方案 v1.0</span><span>已有 2 份 HTML 可接入</span><span>第一版建议：静态网站</span></div><div class="hero-actions"><a class="primary-link" href="#section-2">体验首页原型 ↓</a><a class="quiet-link" href="#section-4">了解实现方式 →</a></div></header>
<div class="overview"><div><strong>项目 → AI → 作品</strong><small>两次主要点击进入指定结果</small></div><div><strong>清单驱动页面</strong><small>增加作品，添加一条记录</small></div><div><strong>原始结果可追溯</strong><small>提示词、模型、轮次一起保存</small></div></div>
<noscript><p>JavaScript 已禁用，设计正文和默认原型仍可阅读，候鸟迁徙链接仍可打开。切换项目需要启用 JavaScript。</p></noscript>
__CONTENT__
<footer><span>设计方案与局部原型 · 尚未发布为线上站点</span><a href="design.md">查看同版本 Markdown 文档 ↗</a></footer></main></div><script>__SCRIPT__</script></body></html>'''
page = page.replace('__STYLE__', css).replace('__CONTENT__', '\n'.join(articles)).replace('__SCRIPT__', script)
(HERE / 'design.html').write_text(page)
print(f'Generated {HERE / "design.html"} ({len(page.encode()):,} bytes)')
