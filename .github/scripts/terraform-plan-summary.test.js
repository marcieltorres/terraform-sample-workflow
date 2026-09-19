const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyAction, groupResourceChanges, buildCounts, truncateList } = require('./terraform-plan-summary.js');

test('classifyAction returns create for a single create action', () => {
  assert.equal(classifyAction(['create']), 'create');
});

test('classifyAction returns update for a single update action', () => {
  assert.equal(classifyAction(['update']), 'update');
});

test('classifyAction returns delete for a single delete action', () => {
  assert.equal(classifyAction(['delete']), 'delete');
});

test('classifyAction returns replace for delete followed by create', () => {
  assert.equal(classifyAction(['delete', 'create']), 'replace');
});

test('classifyAction returns replace for create followed by delete', () => {
  assert.equal(classifyAction(['create', 'delete']), 'replace');
});

test('classifyAction returns no-op for a single no-op action', () => {
  assert.equal(classifyAction(['no-op']), 'no-op');
});

test('classifyAction returns no-op for a single read action', () => {
  assert.equal(classifyAction(['read']), 'no-op');
});

test('groupResourceChanges buckets each resource change under its classified action', () => {
  const resourceChanges = [
    { address: 'aws_s3_bucket.created', change: { actions: ['create'] } },
    { address: 'aws_s3_bucket.updated', change: { actions: ['update'] } },
    {
      address: 'aws_instance.replaced',
      change: { actions: ['delete', 'create'] },
      action_reason: 'requested',
    },
    { address: 'aws_instance.deleted', change: { actions: ['delete'] } },
    { address: 'aws_instance.unchanged', change: { actions: ['no-op'] } },
  ];

  const groups = groupResourceChanges(resourceChanges);

  assert.deepEqual(groups.create, [{ address: 'aws_s3_bucket.created', reason: undefined }]);
  assert.deepEqual(groups.update, [{ address: 'aws_s3_bucket.updated', reason: undefined }]);
  assert.deepEqual(groups.replace, [{ address: 'aws_instance.replaced', reason: 'requested' }]);
  assert.deepEqual(groups.delete, [{ address: 'aws_instance.deleted', reason: undefined }]);
  assert.deepEqual(groups['no-op'], [{ address: 'aws_instance.unchanged', reason: undefined }]);
});

test('buildCounts derives add, change and destroy totals from group sizes', () => {
  const groups = {
    create: ['a', 'b'],
    update: ['c'],
    replace: ['d'],
    delete: ['e', 'f', 'g'],
    'no-op': [],
  };

  const counts = buildCounts(groups);

  assert.equal(counts.create, 2);
  assert.equal(counts.update, 1);
  assert.equal(counts.replace, 1);
  assert.equal(counts.delete, 3);
  assert.equal(counts['no-op'], 0);
  assert.equal(counts.add, 3);
  assert.equal(counts.change, 1);
  assert.equal(counts.destroy, 4);
});

test('truncateList with limit 50 does not truncate a list under the limit', () => {
  const items = Array.from({ length: 49 }, (_, i) => `item-${i}`);

  const result = truncateList(items, 50);

  assert.deepEqual(result.shown, items);
  assert.equal(result.omittedCount, 0);
});

test('truncateList with limit 50 does not truncate a list exactly at the limit', () => {
  const items = Array.from({ length: 50 }, (_, i) => `item-${i}`);

  const result = truncateList(items, 50);

  assert.deepEqual(result.shown, items);
  assert.equal(result.omittedCount, 0);
});

test('truncateList with limit 50 truncates a list over the limit', () => {
  const items = Array.from({ length: 60 }, (_, i) => `item-${i}`);

  const result = truncateList(items, 50);

  assert.deepEqual(result.shown, items.slice(0, 50));
  assert.equal(result.omittedCount, 10);
});

test('truncateList with limit 15 does not truncate a list under the limit', () => {
  const items = Array.from({ length: 14 }, (_, i) => `item-${i}`);

  const result = truncateList(items, 15);

  assert.deepEqual(result.shown, items);
  assert.equal(result.omittedCount, 0);
});

test('truncateList with limit 15 does not truncate a list exactly at the limit', () => {
  const items = Array.from({ length: 15 }, (_, i) => `item-${i}`);

  const result = truncateList(items, 15);

  assert.deepEqual(result.shown, items);
  assert.equal(result.omittedCount, 0);
});

test('truncateList with limit 15 truncates a list over the limit', () => {
  const items = Array.from({ length: 20 }, (_, i) => `item-${i}`);

  const result = truncateList(items, 15);

  assert.deepEqual(result.shown, items.slice(0, 15));
  assert.equal(result.omittedCount, 5);
});
