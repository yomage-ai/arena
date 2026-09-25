import { validateCatalog, selectProject, displayedResults, resultGroups } from './catalog-core.mjs';

const $ = id => document.getElementById(id);
const dialog = $('details-dialog');
let catalog;
let currentProject;
let loadController;
const availability = { available: '已收录', broken: '运行异常', missing: '未收录', failed: '生成失败' };
const validations = { untested: '未验收', passed: '已验收', issues: '存在问题' };
const variants = { original: '一次生成', revised: '迭代修复' };
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
const button = (text, className, action) => {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
};
const notRecorded = value => value === null || value === undefined || value === '' ? '未记录' : value;
function workLink(result, className, label) {
  const link = element('a', className, label);
  link.href = result.entry;
  link.setAttribute('aria-label', `${label}：${result.title}`);
  return link;
}

function showDialog(title, label, content) {
  $('dialog-title').textContent = title;
  $('dialog-eyebrow').textContent = label;
  $('dialog-body').replaceChildren(content);
  $('dialog-status').textContent = '';
  if (!dialog.open) dialog.showModal();
  else $('close-dialog').focus();
  document.body.classList.add('dialog-open');
}
function detailList(entries) {
  const list = element('dl', 'detail-grid');
  for (const [key, value] of entries) {
    const row = element('div');
    row.append(element('dt', null, key), element('dd', null, notRecorded(value)));
    list.append(row);
  }
  return list;
}

function showPrompt(project, requestedVersion) {
  const content = element('div');
  const versions = project.promptVersions;
  // A run without a prompt must remain unknown, even when the project has other prompts.
  if (requestedVersion === null || versions.length === 0) {
    content.append(element('div', 'record-note', '原始提示词待补充'));
    content.append(element('p', null, '当前记录没有可确认的原始提示词。页面上的考察点是测评建议，不能替代生成作品时实际使用的提示词。'));
    content.append(element('p', null, '补齐提示词、模型和生成条件后，再将这份作品纳入正式同题比较。'));
    showDialog(project.title, '同题提示词', content);
    return;
  }
  const selected = versions.find(prompt => prompt.id === requestedVersion) || versions.find(prompt => prompt.id === project.defaultPromptVersionId) || versions[0];
  const promptBody = element('div');
  const render = version => {
    const text = element('textarea', 'prompt-text');
    text.readOnly = true;
    text.value = version.text;
    text.setAttribute('aria-label', `${version.label}完整提示词`);
    promptBody.replaceChildren(element('p', null, `提示词版本：${version.label}`), text);
    if (version.conditions) promptBody.append(element('p', null, `共用条件：${version.conditions}`));
    promptBody.append(button('复制完整提示词', 'primary-button', async () => {
      try {
        await navigator.clipboard.writeText(version.text);
        $('dialog-status').textContent = '提示词已复制。';
      } catch {
        text.focus();
        text.select();
        $('dialog-status').textContent = '自动复制不可用，已选中原文，可使用系统复制操作。';
      }
    }));
  };
  // Specific run records always display exactly their bound prompt.
  if (versions.length > 1 && requestedVersion === undefined) {
    const label = element('label', 'prompt-select-label', '选择提示词版本');
    const select = element('select');
    for (const version of versions) {
      const option = element('option', null, version.label);
      option.value = version.id;
      select.append(option);
    }
    select.value = selected.id;
    select.addEventListener('change', () => {
      $('dialog-status').textContent = '';
      render(versions.find(version => version.id === select.value));
    });
    label.append(select);
    content.append(label);
  }
  render(selected);
  content.append(promptBody);
  showDialog(project.title, '同题提示词', content);
}

function showRecord(result, model) {
  const project = catalog.projects.find(project => project.id === result.projectId);
  const prompt = project.promptVersions.find(version => version.id === result.promptVersionId);
  const content = element('div');
  if (result.notes) content.append(element('div', 'record-note', result.notes));
  content.append(detailList([
    ['生成产品', model.product], ['模型版本', model.version],
    ['提示词版本', prompt?.label], ['生成日期', result.generatedAt],
    ['作品记录', result.runLabel], ['生成方式', variants[result.variant]],
    ['文件状态', availability[result.availability]], ['测评状态', validations[result.validation]],
    ['工具与联网', result.conditions.tools], ['可见参数', result.conditions.parameters],
    ['生成预算', result.conditions.budget], ['人工干预', result.conditions.intervention]
  ]));
  if (result.parentRunId) {
    const parent = catalog.results.find(run => run.id === result.parentRunId);
    content.append(element('p', null, `基于记录「${parent.runLabel}」修复，原始作品单独保留。`));
  }
  if (result.knownIssues.length) {
    content.append(element('h3', null, '已知问题'));
    const list = element('ul', 'rules-list');
    for (const issue of result.knownIssues) list.append(element('li', null, issue));
    content.append(list);
  } else content.append(element('p', null, '尚未填写问题记录，不代表作品已通过完整测评。'));
  content.append(button('查看这份作品的提示词 →', 'text-button', () => showPrompt(project, result.promptVersionId)));
  showDialog(result.title, '生成记录', content);
}

function createCard(group) {
  let selected = group.selected;
  const card = element('article', 'work-card');
  const coverSlot = element('div', 'cover-slot');
  const body = element('div', 'card-body');
  const summary = element('div');
  summary.style.display = 'contents';
  let picker;
  if (group.runs.length > 1) {
    const label = element('label', 'run-picker', `${group.model.label}的生成记录`);
    picker = element('select');
    for (const run of group.runs) {
      const option = element('option', null, `${run.runLabel} · ${variants[run.variant] || '方式待补'} · ${availability[run.availability]}`);
      option.value = run.id;
      picker.append(option);
    }
    picker.value = selected.id;
    picker.addEventListener('change', () => {
      selected = group.runs.find(run => run.id === picker.value);
      render();
    });
    label.append(picker);
    body.append(label);
  }
  body.append(summary);
  card.append(coverSlot, body);
  function render() {
    const canOpen = ['available', 'broken'].includes(selected.availability);
    const cover = canOpen ? workLink(selected, 'cover-link', '打开作品') : element('div', 'cover-link');
    cover.replaceChildren();
    if (selected.cover) {
      const img = element('img', 'work-cover');
      img.alt = `${selected.title}作品预览`;
      img.src = selected.cover;
      img.width = 1440;
      img.height = 900;
      img.loading = 'lazy';
      img.addEventListener('error', () => cover.replaceChildren(element('div', 'missing-cover', '作品封面暂不可用')));
      cover.append(img);
    } else cover.append(element('div', 'missing-cover', '暂无作品封面'));
    if (canOpen) cover.append(element('span', 'cover-open', '↗'));
    coverSlot.replaceChildren(cover);
    const row = element('div', 'model-row');
    const model = element('span', 'model-label');
    const modelName = group.model.version && !group.model.label.startsWith(group.model.version) ? `${group.model.label} · ${group.model.version}` : group.model.label;
    model.append(element('span', 'model-mark', group.model.version ? 'AI' : '?'), document.createTextNode(modelName));
    row.append(model, element('span', `status-badge ${selected.availability === 'available' ? 'available' : 'problem'}`, availability[selected.availability]));
    const meta = element('div', 'card-meta');
    const prompt = currentProject.promptVersions.find(prompt => prompt.id === selected.promptVersionId);
    meta.append(element('span', null, prompt ? prompt.label : '提示词待补'), element('span', null, variants[selected.variant] || '轮次待补'), element('span', null, validations[selected.validation]));
    const actions = element('div', 'card-actions');
    if (canOpen) actions.append(workLink(selected, 'primary-button', selected.availability === 'broken' ? '打开原始作品 ↗' : '打开作品 ↗'));
    else {
      const unavailable = element('button', 'unavailable-button', availability[selected.availability]);
      unavailable.disabled = true;
      unavailable.type = 'button';
      actions.append(unavailable);
    }
    actions.append(button('生成记录 →', 'text-button', () => showRecord(selected, group.model)));
    summary.replaceChildren(row, element('h3', null, selected.title), element('p', 'card-description', selected.description), meta, actions);
  }
  render();
  return card;
}

function renderNavigation() {
  const results = displayedResults(catalog);
  $('project-total').textContent = `${catalog.projects.length}`.padStart(2, '0');
  $('project-nav').replaceChildren(...catalog.projects.map((project, index) => {
    const count = results.filter(result => result.projectId === project.id && result.availability === 'available').length;
    const node = button('', 'project-button', () => navigateProject(project.id));
    node.dataset.project = project.id;
    node.setAttribute('aria-pressed', 'false');
    const name = element('span', 'project-name', project.title);
    name.append(element('small', null, count ? `${count} 份可体验作品` : '暂无可体验作品'));
    node.append(element('span', 'project-index', String(index + 1).padStart(2, '0')), name);
    return node;
  }));
  $('collection-total').textContent = `${catalog.projects.length} 个项目 · ${results.filter(result => result.availability === 'available').length} 份可体验作品`;
}

function renderProjectFromUrl() {
  const requested = new URL(location.href).searchParams.get('project');
  const { project, invalid } = selectProject(catalog, requested);
  currentProject = project;
  if (dialog.open) dialog.close();
  $('notice').hidden = !invalid;
  $('notice').textContent = invalid ? `未找到指定项目，已为你展示「${project.title}」。` : '';
  for (const node of $('project-nav').querySelectorAll('button')) {
    node.setAttribute('aria-pressed', String(node.dataset.project === project.id));
    if (node.dataset.project === project.id) node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  $('breadcrumb').textContent = project.title;
  $('project-title').textContent = project.title;
  $('project-category').textContent = project.category;
  $('project-number').textContent = `PROJECT ${String(catalog.projects.indexOf(project) + 1).padStart(2, '0')}`;
  $('project-description').textContent = project.description;
  $('project-focus').replaceChildren(...project.focus.map(text => element('li', null, text)));
  $('device-note').textContent = project.deviceNote || '';
  const prompt = project.promptVersions.find(version => version.id === project.defaultPromptVersionId) || project.promptVersions[0];
  $('prompt-summary').textContent = prompt ? `${prompt.label} · ${project.promptVersions.length} 个版本` : '原始提示词待补充';
  const groups = resultGroups(catalog, project.id);
  const results = displayedResults(catalog);
  const count = results.filter(result => result.projectId === project.id && result.availability === 'available').length;
  $('available-count').textContent = count;
  $('model-count').textContent = groups.length ? `${groups.length} 组` : '';
  $('empty-state').hidden = groups.length > 0;
  $('browse-available').hidden = !results.some(result => result.availability === 'available');
  $('works-grid').hidden = groups.length === 0;
  $('works-grid').replaceChildren(...groups.map(createCard));
  if (groups.length === 1) {
    const empty = element('div', 'empty-card');
    empty.append(element('div', 'empty-glyph', '＋'), element('h3', null, '等待更多解法'), element('p', null, '同一道题的其他 AI 结果，将并列展示在这里。'));
    $('works-grid').append(empty);
  }
  document.title = `${project.title} · AI 试验场`;
}

function navigateProject(id) {
  const url = new URL(location.href);
  if (url.searchParams.get('project') === id) return;
  url.searchParams.set('project', id);
  history.pushState({}, '', url);
  renderProjectFromUrl();
}

async function loadCatalog() {
  loadController?.abort();
  const controller = new AbortController();
  loadController = controller;
  $('loading').hidden = false;
  $('load-error').hidden = true;
  $('project-content').hidden = true;
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch('./catalog.json', { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
    const loaded = validateCatalog(await response.json());
    if (loadController !== controller) return;
    catalog = loaded;
    renderNavigation();
    renderProjectFromUrl();
    $('project-content').hidden = false;
  } catch (error) {
    if (loadController !== controller) return;
    console.error('Unable to load collection:', error.message);
    $('load-error-message').textContent = location.protocol === 'file:' ? '请通过本地预览服务或部署后的网址打开网站。' : '作品清单暂时不可用，请稍后重试。';
    $('load-error').hidden = false;
  } finally {
    clearTimeout(timeout);
    if (loadController === controller) $('loading').hidden = true;
  }
}

for (const node of document.querySelectorAll('[data-open-rules]')) node.addEventListener('click', () => {
  const content = element('div');
  content.append(element('p', null, '先体验作品，再结合实际提示词和生成条件理解结果。'));
  const list = element('ol', 'rules-list');
  const rules = [
    '同一道题使用固定版本的提示词和共用素材。提示词变更后另存版本，避免将不同条件下的结果混为一组。',
    '记录产品、准确模型版本、工具权限和生成预算。未知项标为“未记录”，不通过作品表现猜测来源。',
    '一次生成与迭代修复分别记录，原始作品独立保留。修复版说明追问与人工干预。',
    '在相同浏览器、设备和视口下检查核心功能、交互与适配。作品的“已收录”表示文件可访问，不等于通过功能验收。',
    '单次样本不代表稳定排名。来源与提示词尚未补齐的作品可以体验，暂不纳入正式同题结论。'
  ];
  for (const text of rules) list.append(element('li', null, text));
  content.append(list);
  showDialog('怎样理解这份测评', '测评规则', content);
});
$('open-prompt').addEventListener('click', () => showPrompt(currentProject));
$('close-dialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
dialog.addEventListener('click', event => {
  const bounds = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
});
$('retry').addEventListener('click', loadCatalog);
$('browse-available').addEventListener('click', () => {
  navigateProject(selectProject(catalog, null).project.id);
  $('main').focus();
});
window.addEventListener('popstate', () => { if (catalog) renderProjectFromUrl(); });
loadCatalog();
