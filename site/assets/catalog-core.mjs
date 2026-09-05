const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function isSitePath(value, prefix) {
  if (typeof value !== 'string' || !value.startsWith(`./${prefix}/`)) return false;
  const parts = value.slice(2).split('/');
  return parts.every(part => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(part) && part !== '.' && part !== '..');
}

export function validateCatalog(catalog) {
  const ensure = (ok, message) => { if (!ok) throw new Error(message); };
  const requiredText = value => typeof value === 'string' && value.trim().length > 0;
  const nullableText = value => value === null || typeof value === 'string';
  const unique = (records, name) => {
    ensure(Array.isArray(records), `${name} must be an array`);
    const ids = new Set();
    for (const record of records) {
      ensure(record && idPattern.test(record.id), `${name}: invalid id`);
      ensure(!ids.has(record.id), `${name}: duplicate id ${record.id}`);
      ids.add(record.id);
    }
    return ids;
  };
  ensure(catalog?.schemaVersion === 1, 'Unsupported catalog version');
  const projectIds = unique(catalog.projects, 'projects');
  const modelIds = unique(catalog.models, 'models');
  const resultIds = unique(catalog.results, 'results');
  ensure(projectIds.size > 0, 'At least one project is required');
  for (const project of catalog.projects) {
    ensure(requiredText(project.title) && requiredText(project.category) && requiredText(project.description), `${project.id}: project text missing`);
    ensure(Array.isArray(project.focus) && project.focus.every(requiredText), `${project.id}: invalid focus`);
    const versions = unique(project.promptVersions, `${project.id} prompts`);
    ensure(project.defaultPromptVersionId === null || versions.has(project.defaultPromptVersionId), `${project.id}: invalid default prompt`);
    ensure(nullableText(project.deviceNote), `${project.id}: invalid device note`);
    for (const prompt of project.promptVersions) {
      ensure(requiredText(prompt.label) && requiredText(prompt.text), `${prompt.id}: prompt label or text missing`);
    }
  }
  for (const model of catalog.models) {
    ensure(requiredText(model.label) && nullableText(model.product) && nullableText(model.version), `${model.id}: invalid model details`);
  }
  const entries = new Set();
  for (const result of catalog.results) {
    ensure(projectIds.has(result.projectId) && modelIds.has(result.modelId), `${result.id}: unknown project or model`);
    const project = catalog.projects.find(project => project.id === result.projectId);
    ensure(result.promptVersionId === null || project.promptVersions.some(prompt => prompt.id === result.promptVersionId), `${result.id}: unknown prompt version`);
    ensure(requiredText(result.title) && requiredText(result.description) && requiredText(result.runLabel), `${result.id}: result text missing`);
    ensure(['available', 'broken', 'missing', 'failed'].includes(result.availability), `${result.id}: invalid availability`);
    ensure(['untested', 'passed', 'issues'].includes(result.validation), `${result.id}: invalid validation`);
    ensure([null, 'original', 'revised'].includes(result.variant), `${result.id}: invalid variant`);
    ensure(nullableText(result.generatedAt) && nullableText(result.notes), `${result.id}: invalid notes or date`);
    ensure(result.conditions && ['tools', 'parameters', 'budget', 'intervention'].every(key => nullableText(result.conditions[key])), `${result.id}: invalid conditions`);
    ensure(Array.isArray(result.knownIssues) && result.knownIssues.every(requiredText), `${result.id}: invalid known issues`);
    ensure(typeof result.featured === 'boolean', `${result.id}: featured must be boolean`);
    if (['available', 'broken'].includes(result.availability)) ensure(isSitePath(result.entry, 'works') && result.entry.endsWith('.html'), `${result.id}: invalid entry`);
    else ensure(result.entry === null, `${result.id}: unavailable results must not have an entry`);
    ensure(result.cover === null || isSitePath(result.cover, 'assets') || isSitePath(result.cover, 'works'), `${result.id}: invalid cover`);
    if (result.entry) {
      ensure(!entries.has(result.entry), `${result.id}: duplicate entry; each result must keep its own file`);
      entries.add(result.entry);
    }
    if (result.parentRunId !== null) {
      ensure(resultIds.has(result.parentRunId) && result.parentRunId !== result.id, `${result.id}: invalid parent run`);
      const parent = catalog.results.find(parent => parent.id === result.parentRunId);
      ensure(parent.projectId === result.projectId && parent.modelId === result.modelId && parent.promptVersionId === result.promptVersionId, `${result.id}: parent must use the same project, model and prompt`);
    }
  }
  for (const result of catalog.results) {
    const visited = new Set([result.id]);
    let parentId = result.parentRunId;
    while (parentId !== null) {
      ensure(!visited.has(parentId), `${result.id}: cyclic parent runs`);
      visited.add(parentId);
      parentId = catalog.results.find(parent => parent.id === parentId).parentRunId;
    }
  }
  return catalog;
}

export function selectProject(catalog, requested) {
  const matched = catalog.projects.find(project => project.id === requested);
  const fallback = catalog.projects.find(project => catalog.results.some(result => result.projectId === project.id && result.availability === 'available')) || catalog.projects[0];
  return { project: matched || fallback, invalid: requested !== null && !matched };
}

export function resultGroups(catalog, projectId) {
  return catalog.models.map(model => {
    const runs = catalog.results.filter(result => result.projectId === projectId && result.modelId === model.id);
    const selected = runs.find(run => run.featured) || runs[0];
    return { model, runs, selected };
  }).filter(group => group.runs.length > 0);
}
