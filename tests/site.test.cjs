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
