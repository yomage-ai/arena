const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const core = import(pathToFileURL(path.join(root, 'site/assets/catalog-core.mjs')));
const fixture = () => JSON.parse(fs.readFileSync(path.join(root, 'site/catalog.json'), 'utf8'));

test('published result directories preserve every archived file and relative resource', () => {
  for (const result of fixture().results.filter(result => result.entry)) {
    const relative = result.entry.slice('./works/'.length);
    const sourceDir = path.dirname(path.join(root, 'results', relative));
    const outputDir = path.dirname(path.join(root, 'site/works', relative));
    const compare = (source, output) => {
      for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory()) compare(path.join(source, entry.name), path.join(output, entry.name));
        else assert.deepEqual(fs.readFileSync(path.join(source, entry.name)), fs.readFileSync(path.join(output, entry.name)), entry.name);
      }
    };
    compare(sourceDir, outputDir);
  }
});

test('imported GPT6-Astra-xhigh records retain their provenance and recovered bicycle files match', () => {
  const catalog = fixture();
  for (const id of ['migration-import-01', 'pvz-import-01', 'bicycle-import-01']) {
    assert.equal(catalog.results.find(result => result.id === id)?.modelId, 'gpt6-astra-xhigh');
  }
  assert.equal(catalog.models.find(model => model.id === 'gpt6-astra-xhigh').version, 'GPT6-Astra-xhigh');
  assert.equal(catalog.results.find(result => result.id === 'bicycle-import-01').entry, './works/bicycle/gpt6-astra-xhigh/import-01/index.html');
  const folder = path.join(root, 'results/bicycle/gpt6-astra-xhigh/import-01');
  assert.deepEqual(fs.readFileSync(path.join(folder, 'index.html')), fs.readFileSync(path.join(folder, 'pelican-ride.html')));
});

test('every catalog result and cover resolves to an existing publishable file', async () => {
  const { validateCatalog } = await core;
  const catalog = validateCatalog(fixture());
  for (const result of catalog.results) {
    for (const file of [result.entry, result.cover].filter(Boolean)) assert.ok(fs.statSync(path.join(root, 'site', file)).isFile(), file);
  }
});

test('unknown URL projects fall back to a project with a playable work; a planned project remains selectable', async () => {
  const { selectProject } = await core;
  const catalog = fixture();
  catalog.results = catalog.results.filter(result => result.projectId !== 'bicycle');
  assert.equal(selectProject(catalog, 'bicycle').project.id, 'bicycle');
  for (const requested of ['missing', '__proto__', '../../README.md', '']) {
    const selection = selectProject(catalog, requested);
    assert.equal(selection.project.id, 'migration');
    assert.equal(selection.invalid, true);
  }
  assert.equal(selectProject(catalog, null).invalid, false);
  catalog.projects.reverse();
  assert.notEqual(selectProject(catalog, null).project.id, 'bicycle');
});

test('adding a second AI and multiple runs preserves all results and selects its designated run', async () => {
  const { validateCatalog, resultGroups } = await core;
  const catalog = fixture();
  const existingGroups = resultGroups(catalog, 'migration').length;
  catalog.models.push({ id: 'test-model', label: 'Test model', product: 'Test product', version: 'Test version' });
  const run = { ...structuredClone(catalog.results[0]), id: 'test-original', modelId: 'test-model', runLabel: '第 1 次', variant: 'original', featured: false, entry: './works/migration/test-model/run-01/index.html' };
  const revision = { ...structuredClone(run), id: 'test-revised', parentRunId: run.id, runLabel: '第 1 次修复', variant: 'revised', featured: true, entry: './works/migration/test-model/run-01-fix/index.html' };
  catalog.results.push(run, revision);
  validateCatalog(catalog);
  const groups = resultGroups(catalog, 'migration');
  assert.equal(groups.length, existingGroups + 1);
  const added = groups.find(group => group.model.id === 'test-model');
  assert.equal(added.runs.length, 2);
  assert.equal(added.selected.id, 'test-revised');
  catalog.results = catalog.results.filter(result => result.projectId !== 'bicycle');
  assert.equal(resultGroups(catalog, 'bicycle').length, 0);
});

test('hidden models stay archived but do not appear in project groups or visible counts', async () => {
  const { validateCatalog, displayedResults, resultGroups } = await core;
  const catalog = validateCatalog(fixture());
  const doubao = catalog.models.find(model => model.id === 'doubao-seed-2-1-pro');
  assert.equal(doubao.hidden, true);
  assert.equal(catalog.results.filter(result => result.modelId === doubao.id).length, 4);
  assert.equal(displayedResults(catalog).filter(result => result.availability === 'available').length, 19);
  for (const project of catalog.projects) {
    const visible = project.id === 'bicycle'
      ? ['gpt6-astra-xhigh', 'gpt6-sol-max', 'gpt5-6-sol-max', 'opus-5-5']
      : project.id === 'lunar-rover'
        ? ['gpt6-astra-xhigh', 'gpt6-sol-max', 'gpt5-6-sol-max', 'opus-5-5']
        : project.id === 'migration'
          ? ['gpt6-astra-xhigh', 'gpt6-sol-max', 'gpt5-6-sol-max', 'opus-5-5']
        : project.id === 'bottled-ocean'
          ? ['gpt6-astra-xhigh', 'gpt6-sol-max', 'opus-5-5']
          : ['gpt6-astra-xhigh', 'gpt6-sol-max', 'gpt5-6-sol-max', 'opus-5-5'];
    assert.deepEqual(resultGroups(catalog, project.id).map(group => group.model.id), visible);
  }
  doubao.hidden = false;
  assert.equal(resultGroups(catalog, 'migration').length, 5);
  assert.equal(displayedResults(catalog).filter(result => result.availability === 'available').length, 22);
});

test('bottled ocean links its original prompt and exact archived HTML to GPT6-sol', async () => {
  const { selectProject, resultGroups } = await core;
  const catalog = fixture();
  const project = selectProject(catalog, 'bottled-ocean').project;
  assert.equal(project.id, 'bottled-ocean');
  const prompt = project.promptVersions.find(item => item.id === 'bottled-ocean-v1');
  assert.match(prompt.text, /^用WebGL\(Three\.jsr160CDN\)/);
  assert.match(prompt.text, /珊\n瑚/);
  assert.match(prompt.text, /InstancedMesh体素批渲染/);
  const result = catalog.results.find(item => item.id === 'bottled-ocean-gpt6-sol-max-import-01');
  assert.equal(result.modelId, 'gpt6-sol-max');
  assert.equal(result.promptVersionId, prompt.id);
  assert.match(result.conditions.parameters, /max/);
  assert.equal(resultGroups(catalog, project.id).length, 3);
  const folder = path.join(root, 'results/bottled-ocean/gpt6-sol-max/import-01');
  const original = fs.readFileSync(path.join(folder, 'bottled-ocean.html'));
  assert.deepEqual(fs.readFileSync(path.join(folder, 'index.html')), original);
  assert.equal(require('node:crypto').createHash('sha256').update(original).digest('hex'), 'b63adca34a64b377a20fc9a324c10713348c1dde06ba5a2d2d9cecc20bb00e9f');
});

test('GPT6-Astra-xhigh bottled ocean retains the confirmed model and exact source HTML', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'bottled-ocean-gpt6-astra-xhigh-import-01');
  assert.equal(result.modelId, 'gpt6-astra-xhigh');
  assert.equal(result.promptVersionId, 'bottled-ocean-v1');
  assert.match(result.conditions.parameters, /xhigh/);
  assert.equal(result.entry, './works/bottled-ocean/gpt6-astra-xhigh/import-01/index.html');
  const folder = path.join(root, 'results/bottled-ocean/gpt6-astra-xhigh/import-01');
  const original = fs.readFileSync(path.join(folder, 'bottle-ocean.html'));
  assert.deepEqual(fs.readFileSync(path.join(folder, 'index.html')), original);
  assert.equal(require('node:crypto').createHash('sha256').update(original).digest('hex'), '25d2aee2d1718215c4702e489035c4c791758eac9305a6d6aa3420a20fb0dc94');
});

test('Opus bottled ocean preserves its original single HTML and source project', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'bottled-ocean-opus-5-5-import-01');
  assert.equal(result.modelId, 'opus-5-5');
  assert.equal(result.promptVersionId, 'bottled-ocean-v1');
  assert.match(result.conditions.parameters, /extra/);
  assert.equal(result.entry, './works/bottled-ocean/opus-5-5/import-01/index.html');
  const folder = path.join(root, 'results/bottled-ocean/opus-5-5/import-01');
  const original = fs.readFileSync(path.join(folder, 'original.html'));
  assert.deepEqual(fs.readFileSync(path.join(folder, 'index.html')), original);
  assert.deepEqual(fs.readFileSync(path.join(root, 'source-projects/opus-5-5-bottled-ocean/dist/瓶中沧海.html')), original);
  assert.equal(require('node:crypto').createHash('sha256').update(original).digest('hex'), 'cb293f07716738dd968b65ef60cc615aa74a90ba969e9c03da9e976bc89255c2');
});

test('GPT6-sol PVZ keeps its source build and archived single HTML identical', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'pvz-gpt6-sol-max-import-01');
  assert.equal(result.modelId, 'gpt6-sol-max');
  assert.equal(result.promptVersionId, 'pvz-v1');
  assert.match(result.conditions.parameters, /max/);
  assert.equal(result.entry, './works/pvz/gpt6-sol-max/import-01/index.html');
  const source = path.join(root, 'source-projects/gpt6-sol-pvz');
  const template = fs.readFileSync(path.join(source, 'src/index.template.html'), 'utf8');
  const built = template.replace('/*__STYLES__*/', fs.readFileSync(path.join(source, 'src/styles.css'), 'utf8'))
    .replace('/*__GAME__*/', fs.readFileSync(path.join(source, 'src/game.js'), 'utf8'));
  const archived = fs.readFileSync(path.join(root, 'results/pvz/gpt6-sol-max/import-01/index.html'));
  assert.deepEqual(Buffer.from(built), archived);
  assert.deepEqual(fs.readFileSync(path.join(source, 'index.html')), archived);
  assert.equal(require('node:crypto').createHash('sha256').update(archived).digest('hex'), 'b761a39cacc42d774f216523708d6582181c7d94f05b46e20b452abec997a175');
});

test('Opus PVZ keeps its single HTML and editable build tree intact', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'pvz-opus-5-5-import-01');
  assert.equal(result.modelId, 'opus-5-5');
  assert.equal(result.promptVersionId, 'pvz-v1');
  assert.match(result.conditions.parameters, /extra/);
  assert.equal(result.entry, './works/pvz/opus-5-5/import-01/index.html');
  const source = path.join(root, 'source-projects/opus-5-5-pvz');
  const archived = fs.readFileSync(path.join(root, 'results/pvz/opus-5-5/import-01/index.html'));
  assert.deepEqual(fs.readFileSync(path.join(source, 'dist/植物大战僵尸.html')), archived);
  assert.equal(require('node:crypto').createHash('sha256').update(archived).digest('hex'), 'ebcdb78af9636e87c9c0a78a6cc9ba4398b92117a3fc3db5202d37d7aae9310b');
  for (const relative of ['src/main.js', 'src/scenes/gameScene.js', 'src/game/levels.js', 'tools/build.mjs', 'build/bundle.js', 'build/bundle.min.js', 'package-lock.json']) {
    assert.ok(fs.statSync(path.join(source, relative)).isFile(), relative);
  }
});

test('Opus bicycle keeps its original file and extra thinking-strength record', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'bicycle-opus-5-5-import-01');
  assert.equal(result.modelId, 'opus-5-5');
  assert.equal(result.promptVersionId, 'bicycle-v1');
  assert.match(result.conditions.parameters, /extra/);
  assert.equal(result.entry, './works/bicycle/opus-5-5/import-01/index.html');
  const original = fs.readFileSync(path.join(root, 'results/bicycle/opus-5-5/import-01/pelican-bike.html'));
  assert.equal(require('node:crypto').createHash('sha256').update(original).digest('hex'), 'b503c1db5a5f34e6dbfa7d7b7c5e0f49d7e7fa85622030f3e4e71e85739dbc9e');
});

test('GPT6-sol bicycle retains the imported original and max thinking-strength record', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'bicycle-gpt6-sol-max-import-01');
  assert.equal(result.modelId, 'gpt6-sol-max');
  assert.equal(result.promptVersionId, 'bicycle-v1');
  assert.match(result.conditions.parameters, /max/);
  assert.equal(result.entry, './works/bicycle/gpt6-sol-max/import-01/index.html');
  const original = fs.readFileSync(path.join(root, 'results/bicycle/gpt6-sol-max/import-01/index.html'));
  assert.equal(require('node:crypto').createHash('sha256').update(original).digest('hex'), '8f05c7b185c8299870812359a336458e12292896b47e54e5febad4c6e7e80796');
});

test('GPT6-sol lunar rover retains the imported entry, local assets and max model record', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'lunar-rover-gpt6-sol-max-import-01');
  assert.equal(result.modelId, 'gpt6-sol-max');
  assert.equal(result.promptVersionId, 'lunar-rover-v1');
  assert.match(result.conditions.parameters, /max/);
  assert.equal(result.entry, './works/lunar-rover/gpt6-sol-max/import-01/index.html');
  const folder = path.join(root, 'results/lunar-rover/gpt6-sol-max/import-01');
  assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(folder, 'index.html'))).digest('hex'), '41c8766f1f20c7d90d5b2b2dfbbff77ca959bf22679f34f2df90dfa62344de0d');
  for (const relative of ['styles.css', 'main.js', 'assets/moon_04_diff_2k.jpg', 'vendor/three/three.module.js', 'vendor/three/addons/controls/OrbitControls.js']) {
    assert.ok(fs.statSync(path.join(folder, relative)).isFile(), relative);
  }
});

test('imported lunar rover keeps its original HTML and all scene modules', () => {
  const catalog = fixture();
  const result = catalog.results.find(item => item.id === 'lunar-rover-opus-5-5-import-01');
  assert.equal(result.promptVersionId, 'lunar-rover-v1');
  assert.equal(result.entry, './works/lunar-rover/opus-5-5/import-01/index.html');
  const folder = path.join(root, 'results/lunar-rover/opus-5-5/import-01');
  const original = fs.readFileSync(path.join(folder, 'original.html'));
  assert.equal(require('node:crypto').createHash('sha256').update(original).digest('hex'), 'aa1f524aa6f81cb5c99d82792158e817da82b3edeb560807a6489a3dc0014a3a');
  for (const name of ['main', 'terrain', 'rover-model', 'rover', 'textures', 'sky', 'noise', 'effects']) assert.ok(fs.statSync(path.join(folder, 'js', `${name}.js`)).isFile(), name);
});

test('both newly imported migration works retain their original bytes', () => {
  const catalog = fixture();
  const crypto = require('node:crypto');
  for (const [id, modelId, sha256] of [
    ['migration-opus-5-5-import-01', 'opus-5-5', '7d516efa50c393a1b1dd8c7c5d3e60b28cb45aebebe983e00a594a83c32a2ad7'],
    ['migration-gpt6-sol-max-import-01', 'gpt6-sol-max', 'f047d40fa7caecd207ff763003e2d90d85ebd3b3fcfb760d8a4c175d89b482ec']
  ]) {
    const result = catalog.results.find(item => item.id === id);
    assert.equal(result.modelId, modelId);
    assert.equal(result.promptVersionId, 'migration-v1');
    const original = fs.readFileSync(path.join(root, 'results', result.entry.slice('./works/'.length)));
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), sha256);
  }
});

test('results cannot silently refer to another prompt, model, project or output path', async () => {
  const { validateCatalog } = await core;
  for (const patch of [
    { promptVersionId: 'not-recorded' }, { modelId: 'missing' }, { projectId: 'missing' },
    { entry: 'https://example.com/work.html' }, { entry: './works/../private.html' },
    { entry: './works/%2e%2e/private.html' }, { entry: './works/one.html?x=1' },
    { entry: './works/one\\private.html' }
  ]) {
    const catalog = fixture();
    Object.assign(catalog.results[0], patch);
    assert.throws(() => validateCatalog(catalog), JSON.stringify(patch));
  }
  const duplicate = fixture();
  duplicate.results[1].entry = duplicate.results[0].entry;
  assert.throws(() => validateCatalog(duplicate), /duplicate entry/);
});

test('missing outputs and generation failures remain distinct, without a clickable entry', async () => {
  const { validateCatalog } = await core;
  for (const availability of ['missing', 'failed']) {
    const catalog = fixture();
    Object.assign(catalog.results[0], { availability, entry: null });
    assert.doesNotThrow(() => validateCatalog(catalog));
    catalog.results[0].entry = './works/migration/gpt6-astra-xhigh/import-01/index.html';
    assert.throws(() => validateCatalog(catalog), /unavailable results/);
  }
});

test('original prompt text is retained verbatim and revisions cannot cross prompt versions', async () => {
  const { validateCatalog } = await core;
  const catalog = fixture();
  const originalText = '第一行\n\n第二行  保留空格 <script>仅作为文字</script>';
  catalog.projects[0].promptVersions = [{ id: 'migration-v1', label: 'v1', text: originalText }, { id: 'migration-v2', label: 'v2', text: 'changed' }];
  catalog.projects[0].defaultPromptVersionId = 'migration-v1';
  catalog.results[0].promptVersionId = 'migration-v1';
  assert.equal(validateCatalog(catalog).projects[0].promptVersions[0].text, originalText);
  const revision = { ...structuredClone(catalog.results[0]), id: 'bad-revision', parentRunId: catalog.results[0].id, promptVersionId: 'migration-v2', entry: './works/migration/gpt6-astra-xhigh/import-02/index.html' };
  catalog.results.push(revision);
  assert.throws(() => validateCatalog(catalog), /same project, model and prompt/);
});

test('cyclic revision chains are rejected', async () => {
  const { validateCatalog } = await core;
  const catalog = fixture();
  const revision = { ...structuredClone(catalog.results[0]), id: 'cyclic-run', entry: './works/migration/gpt6-astra-xhigh/import-02/index.html', parentRunId: catalog.results[0].id };
  catalog.results[0].parentRunId = revision.id;
  catalog.results.push(revision);
  assert.throws(() => validateCatalog(catalog), /cyclic/);
});
