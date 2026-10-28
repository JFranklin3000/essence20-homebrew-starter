import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULE_ID, RULE_HOUSE_RULES, STACKING_EDGES, registerExampleHouseRules, stackingEdges } from '../scripts/house-rules.mjs';

function payload(sources) {
  const added = [];
  return { sources, added, addSource: source => added.push(source) };
}

test('every example is registered under the module, prefixed with its id; the code one gets its hook', () => {
  const registered = [];
  const hooks = [];
  const api = { registerHouseRule: rule => registered.push(rule), houseRuleEnabled: () => true };
  assert.equal(registerExampleHouseRules(api, { on: (name, fn) => hooks.push([name, fn]) }), true);
  assert.deepEqual(registered.map(rule => rule.id), [...RULE_HOUSE_RULES.map(rule => rule.id), STACKING_EDGES]);
  for (const rule of registered) {
    assert.equal(rule.module, MODULE_ID);
    assert.ok(rule.id.startsWith(`${MODULE_ID}-`), rule.id);
    assert.ok(rule.label && rule.hint, rule.id);
  }

  assert.deepEqual(hooks.map(([name]) => name), ['essence20.preRollOptions']);
});

test('the rules examples use rule shapes the system knows', () => {
  for (const { rules } of RULE_HOUSE_RULES) {
    for (const rule of rules) {
      if (rule.type == 'LevelPick') {
        assert.ok(['generalPerk', 'gridPower'].includes(rule.kind));
        assert.ok(rule.levels.length && rule.levels.every(level => /^\d+$/.test(level)));
        continue;
      }

      assert.equal(rule.type, 'RollModifier');
      assert.ok(rule.edge === true || rule.immune?.includes('untrainedSnag'));
      assert.deepEqual(rule.when, ['skill:initiative']);
    }
  }
});

test('Extra General Perk: one General Perk at level 1', () => {
  const extra = RULE_HOUSE_RULES.find(rule => rule.id == `${MODULE_ID}-extra-general-perk`);
  assert.deepEqual(extra.rules, [{ type: 'LevelPick', kind: 'generalPerk', levels: ['1'] }]);
});

test('an older Essence20 without house rules: skipped, with a warning', () => {
  const warn = console.warn;
  let warned = '';
  console.warn = text => (warned = text);
  try {
    assert.equal(registerExampleHouseRules(undefined), false);
  } finally {
    console.warn = warn;
  }

  assert.match(warned, /6\.0\.7/);
});

test('extra Edges and Snags: ↑1 for two or more Edge sources, ↓1 for two or more Snags, nothing while off', () => {
  const on = () => true;
  const two = payload([{ edge: true }, { edge: true }, { snag: true }]);
  stackingEdges(two, on);
  assert.deepEqual(two.added.map(source => [source.shiftUp ?? 0, source.shiftDown ?? 0]), [[1, 0]]);

  const snags = payload([{ snag: true }, { snag: true }]);
  stackingEdges(snags, on);
  assert.deepEqual(snags.added.map(source => source.shiftDown), [1]);

  const off = payload([{ edge: true }, { edge: true }]);
  stackingEdges(off, () => false);
  assert.deepEqual(off.added, []);
});
