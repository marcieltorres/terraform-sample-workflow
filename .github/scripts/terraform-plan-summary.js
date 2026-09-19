const fs = require('node:fs');

const GROUP_ORDER = ['create', 'update', 'replace', 'delete', 'no-op'];

const GROUP_META = {
  create: { icon: '🟢', label: 'Create', color: '\x1b[32m' },
  update: { icon: '🟡', label: 'Update', color: '\x1b[33m' },
  replace: { icon: '🔁', label: 'Replace', color: '\x1b[35m' },
  delete: { icon: '🔴', label: 'Destroy', color: '\x1b[31m' },
  'no-op': { icon: '⚪', label: 'No changes', color: '\x1b[90m' },
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function classifyAction(actions) {
  const set = new Set(actions || []);

  if (set.size === 2 && set.has('create') && set.has('delete')) {
    return 'replace';
  }

  if (set.size === 1) {
    const [action] = set;
    if (action === 'create') return 'create';
    if (action === 'update') return 'update';
    if (action === 'delete') return 'delete';
    if (action === 'no-op' || action === 'read') return 'no-op';
  }

  return 'no-op';
}

function groupResourceChanges(resourceChanges) {
  const groups = { create: [], update: [], replace: [], delete: [], 'no-op': [] };

  for (const resourceChange of resourceChanges || []) {
    const action = classifyAction(resourceChange.change?.actions);
    groups[action].push({ address: resourceChange.address, reason: resourceChange.action_reason });
  }

  return groups;
}

function buildCounts(groups) {
  const create = groups.create.length;
  const update = groups.update.length;
  const replace = groups.replace.length;
  const del = groups.delete.length;
  const noOp = groups['no-op'].length;

  return {
    create,
    update,
    replace,
    delete: del,
    'no-op': noOp,
    add: create + replace,
    change: update,
    destroy: del + replace,
  };
}

function truncateList(items, limit) {
  if (items.length <= limit) {
    return { shown: items, omittedCount: 0 };
  }

  return { shown: items.slice(0, limit), omittedCount: items.length - limit };
}

function readPlanJson(path) {
  if (!path) return null;

  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function buildReport() {
  const meta = {
    initOutcome: process.env.INIT_OUTCOME || '',
    workspaceOutcome: process.env.WORKSPACE_OUTCOME || '',
    fmtOutcome: process.env.FMT_OUTCOME || '',
    validateOutcome: process.env.VALIDATE_OUTCOME || '',
    planOutcome: process.env.PLAN_OUTCOME || '',
    workingDir: process.env.WORKING_DIR || '',
    workspace: process.env.WORKSPACE || 'default',
    repository: process.env.GITHUB_REPOSITORY || '',
    actor: process.env.GITHUB_ACTOR || '',
  };

  const planOutput = process.env.PLAN_OUTPUT || '';
  const plan = readPlanJson(process.env.PLAN_JSON_PATH);

  if (!plan) {
    return { meta, groups: null, counts: null, planOutput, hasStructuredData: false };
  }

  const groups = groupResourceChanges(plan.resource_changes);
  const counts = buildCounts(groups);

  return { meta, groups, counts, planOutput, hasStructuredData: true };
}

function renderMarkdownSummary(report) {
  const { meta, groups, counts, planOutput, hasStructuredData } = report;
  const success = meta.planOutcome === 'success';
  const lines = [];

  lines.push(success ? '## ✅ Terraform Plan Success' : '## ❌ Terraform Plan Failed');
  lines.push('');
  lines.push('| Step | Result |');
  lines.push('|---|---|');
  lines.push(`| Init | \`${meta.initOutcome}\` |`);
  lines.push(`| Workspace | \`${meta.workspaceOutcome}\` |`);
  lines.push(`| Format | \`${meta.fmtOutcome}\` |`);
  lines.push(`| Validate | \`${meta.validateOutcome}\` |`);
  lines.push(`| Plan | \`${meta.planOutcome}\` |`);

  if (hasStructuredData) {
    lines.push('');
    lines.push(
      `| ${GROUP_META.create.icon} Create | ${GROUP_META.update.icon} Update | ${GROUP_META.replace.icon} Replace | ${GROUP_META.delete.icon} Destroy | ${GROUP_META['no-op'].icon} No changes |`
    );
    lines.push('|---|---|---|---|---|');
    lines.push(`| ${counts.create} | ${counts.update} | ${counts.replace} | ${counts.delete} | ${counts['no-op']} |`);

    for (const key of GROUP_ORDER) {
      const items = groups[key];
      if (items.length === 0) continue;

      const meta2 = GROUP_META[key];
      const openAttr = key === 'delete' || key === 'replace' ? ' open' : '';

      lines.push('');
      lines.push(`<details${openAttr}>`);
      lines.push(`<summary>${meta2.icon} ${meta2.label} (${items.length})</summary>`);
      lines.push('');

      const { shown, omittedCount } = truncateList(items, 50);
      for (const item of shown) {
        const reasonSuffix = key === 'replace' && item.reason ? ` (${item.reason})` : '';
        lines.push(`- \`${item.address}\`${reasonSuffix}`);
      }

      if (omittedCount > 0) {
        lines.push('');
        lines.push(`_+${omittedCount} resources omitted_`);
      }

      lines.push('');
      lines.push('</details>');
    }
  }

  lines.push('');
  lines.push('<details>');
  lines.push('<summary>Full plan (raw)</summary>');
  lines.push('');
  lines.push('```terraform');
  lines.push(planOutput);
  lines.push('```');
  lines.push('');
  lines.push('</details>');
  lines.push('');
  lines.push(`**Directory:** \`${meta.workingDir}\``);
  lines.push(`**Workspace:** \`${meta.workspace}\``);
  lines.push(`**Actor:** @${meta.actor}`);

  return lines.join('\n');
}

function renderPlainTextSummary(report) {
  const { meta, groups, counts, planOutput, hasStructuredData } = report;
  const status = meta.planOutcome === 'success' ? 'OK' : 'FAIL';
  const lines = [];

  lines.push(
    `Terraform Plan (${status}) — init:${meta.initOutcome} workspace:${meta.workspaceOutcome} fmt:${meta.fmtOutcome} validate:${meta.validateOutcome} plan:${meta.planOutcome}`
  );

  if (!hasStructuredData) {
    lines.push('Structured summary unavailable (terraform show -json failed or no plan was generated).');
    lines.push(planOutput);
    return lines.join('\n');
  }

  lines.push('');
  lines.push(`${BOLD}Plan summary:${RESET}`);
  for (const key of GROUP_ORDER) {
    const meta2 = GROUP_META[key];
    lines.push(`  ${meta2.color}${key.padEnd(8)} ${counts[key]}${RESET}`);
  }

  lines.push('');
  lines.push(`Plan: ${counts.add} to add, ${counts.change} to change, ${counts.destroy} to destroy`);

  for (const key of ['create', 'update', 'replace', 'delete']) {
    const items = groups[key];
    if (items.length === 0) continue;

    const meta2 = GROUP_META[key];

    lines.push('');
    lines.push(`${meta2.color}${BOLD}${meta2.label} (${items.length}):${RESET}`);

    const { shown, omittedCount } = truncateList(items, 50);
    for (const item of shown) {
      const reasonSuffix = key === 'replace' && item.reason ? ` (${item.reason})` : '';
      lines.push(`  ${meta2.color}- ${item.address}${reasonSuffix}${RESET}`);
    }

    if (omittedCount > 0) {
      lines.push(`  ${GROUP_META['no-op'].color}+${omittedCount} omitted${RESET}`);
    }
  }

  return lines.join('\n');
}

async function commentPlan({ github, context }, report) {
  await github.rest.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: renderMarkdownSummary(report),
  });
}

async function writeJobSummary({ core }, report) {
  await core.summary.addRaw(renderMarkdownSummary(report)).write();
}

function printLogSummary({ core }, report) {
  core.info(renderPlainTextSummary(report));
}

module.exports = {
  classifyAction,
  groupResourceChanges,
  buildCounts,
  buildReport,
  renderMarkdownSummary,
  renderPlainTextSummary,
  truncateList,
  commentPlan,
  writeJobSummary,
  printLogSummary,
};
