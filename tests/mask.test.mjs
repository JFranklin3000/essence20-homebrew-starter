import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_ID } from '../scripts/house-rules.mjs';
import {
  BONDED_MASKS, CONCEALED_WEAPONS, MASK_RULE_HOUSE_RULES, MASK_SWITCH_HOUSE_RULES, registerMaskHouseRules,
} from '../scripts/mask/house-rules.mjs';
import {
  bondHolds, bondOf, bondOnEquip, crewWearing, isMask, rebondAllUpdates, rebondMask, registerMaskTags,
} from '../scripts/mask/mask-tags.mjs';

// M.A.S.K. (mask-work/MASK_PLAN.md): house rules, rule tags and mask bonds.

let nextId = 1;
function mask(name, { bondedTo = '', equipped = true } = {}) {
  return { id: `m${nextId++}`, name, type: 'gear', system: { equipped }, flags: { [MODULE_ID]: { mask: true, bondedTo } } };
}

function actor(items = [], extra = {}) {
  const made = { id: `a${nextId++}`, uuid: '', type: 'playerCharacter', items: { contents: items }, system: {}, ...extra };
  made.uuid = `Actor.${made.id}`;
  for (const item of items) {
    item.parent = made;
  }

  return made;
}

test('house rules: registered under the module, ids prefixed; Concealed Weapons and Bonded Masks on by default', () => {
  const registered = [];
  assert.equal(registerMaskHouseRules({ registerHouseRule: rule => registered.push(rule) }), true);
  assert.deepEqual(registered.map(rule => rule.id), [...MASK_RULE_HOUSE_RULES, ...MASK_SWITCH_HOUSE_RULES].map(rule => rule.id));
  for (const rule of registered) {
    assert.equal(rule.module, MODULE_ID);
    assert.ok(rule.id.startsWith(`${MODULE_ID}-mask-`), rule.id);
    assert.ok(rule.label.startsWith('M.A.S.K.: ') && rule.hint, rule.id);
  }

  assert.deepEqual(registered.map(rule => [rule.id, !!rule.default]), [
    [CONCEALED_WEAPONS, true], [`${MODULE_ID}-mask-disguised-vehicles`, false], [BONDED_MASKS, true],
  ]);
  assert.deepEqual(MASK_SWITCH_HOUSE_RULES.map(rule => rule.rules), [undefined]);
  assert.equal(registerMaskHouseRules(undefined), false);
});

test('Concealed Weapons: an early BeforeRoll cancel on a Strike-only attack of a vehicle out of Strike Mode', () => {
  const [rule] = MASK_RULE_HOUSE_RULES.find(houseRule => houseRule.id == CONCEALED_WEAPONS).rules;
  assert.equal(rule.type, 'BeforeRoll');
  assert.equal(rule.cancel, true);
  assert.equal(rule.early, true);
  assert.ok(rule.message);
  assert.deepEqual(rule.when, ['self:type:vehicle', 'not:self:marked:strikeMode', `item:data:flags.${MODULE_ID}.strikeOnly=true`]);
});

test('Disguised Vehicles: an Edge for a vehicle out of Strike Mode, on Deception or Infiltration', () => {
  const [rule] = MASK_RULE_HOUSE_RULES.find(houseRule => houseRule.id.endsWith('-disguised-vehicles')).rules;
  assert.equal(rule.type, 'RollModifier');
  assert.equal(rule.edge, true);
  assert.deepEqual(rule.when, ['self:type:vehicle', 'not:self:marked:strikeMode', { any: ['skill:deception', 'skill:infiltration'] }]);
});

test('a mask is gear with the flag', () => {
  assert.equal(isMask(mask('Spectrum')), true);
  assert.equal(isMask({ type: 'gear', flags: {} }), false);
  assert.equal(isMask({ type: 'weapon', flags: { [MODULE_ID]: { mask: true } } }), false);
});

test('the bond: unbonded works for anyone, bonded only for its wearer, everyone while Bonded Masks is off', () => {
  const spectrum = mask('Spectrum');
  const matt = actor([spectrum]);
  assert.equal(bondHolds(spectrum, matt), true);
  spectrum.flags[MODULE_ID].bondedTo = matt.id;
  assert.equal(bondHolds(spectrum, matt), true);
  const mayhem = actor();
  assert.equal(bondHolds(spectrum, mayhem), false);
  assert.equal(bondHolds(spectrum, mayhem, id => id != BONDED_MASKS), true);
  assert.equal(bondHolds({ type: 'weapon' }, mayhem), true);
});

test('an unbonded mask bonds to whoever puts it on; a bonded one keeps its bond', () => {
  const fresh = mask('Aura', { equipped: false });
  const gloria = actor([fresh]);
  const changes = { system: { equipped: true } };
  bondOnEquip(fresh, changes);
  assert.equal(changes.flags[MODULE_ID].bondedTo, gloria.id);

  const stolen = mask('Viper', { bondedTo: 'mayhem', equipped: false });
  actor([stolen]);
  const again = { system: { equipped: true } };
  bondOnEquip(stolen, again);
  assert.equal(again.flags, undefined);

  const off = { system: { equipped: false } };
  bondOnEquip(fresh, off);
  assert.equal(off.flags, undefined);
});

test('a new actor rebonds its own masks', () => {
  const old = mask('Spectrum', { bondedTo: 'oldCopy' });
  const blank = mask('Lava Shot');
  const matt = actor([old, blank]);
  assert.deepEqual(rebondAllUpdates(matt), [{ _id: old.id, [`flags.${MODULE_ID}.bondedTo`]: matt.id }]);
});

test('only the GM rebonds', async () => {
  const stolen = mask('Spectrum', { bondedTo: 'matt' });
  const mayhem = actor([stolen]);
  stolen.update = async changes => {
    stolen.flags[MODULE_ID].bondedTo = changes[`flags.${MODULE_ID}.bondedTo`];
  };
  globalThis.game = { user: { isGM: false } };
  assert.equal(await rebondMask(stolen), null);
  globalThis.game.user.isGM = true;
  await rebondMask(stolen);
  assert.equal(bondOf(stolen), mayhem.id);
  await rebondMask(stolen, { clear: true });
  assert.equal(bondOf(stolen), '');
});

test('crewWearing: someone aboard wears a working mask, by name or any', () => {
  const spectrum = mask('Spectrum');
  const matt = actor([spectrum]);
  spectrum.flags[MODULE_ID].bondedTo = matt.id;
  const thunderhawk = { type: 'vehicle', system: { actors: { a: { uuid: matt.uuid }, b: { uuid: 'Actor.gone' } } } };
  const resolve = uuid => (uuid == matt.uuid ? matt : null);
  assert.equal(crewWearing(thunderhawk, 'spectrum', { resolve }), true);
  assert.equal(crewWearing(thunderhawk, '', { resolve }), true);
  assert.equal(crewWearing(thunderhawk, 'Viper', { resolve }), false);
  spectrum.flags[MODULE_ID].bondedTo = 'someoneElse';
  assert.equal(crewWearing(thunderhawk, 'Spectrum', { resolve }), false);
  assert.equal(crewWearing(thunderhawk, 'Spectrum', { resolve, enabled: () => false }), true);
  assert.equal(crewWearing({ system: {} }, '', { resolve }), false);
});

test('the tags are registered through the public API, with phrases', () => {
  const tags = new Map();
  const api = { registerTag: (name, fn, meta) => tags.set(name, { fn, meta }), houseRuleEnabled: () => true };
  assert.equal(registerMaskTags(api), true);
  assert.deepEqual([...tags.keys()], ['item:mask', 'self:maskBonded', 'self:crewWearing']);
  for (const { meta } of tags.values()) {
    assert.ok(meta.phrase);
  }

  const viper = mask('Viper', { bondedTo: 'mayhem' });
  const matt = actor();
  assert.equal(tags.get('item:mask').fn('', { item: viper }), true);
  assert.equal(tags.get('self:maskBonded').fn('', { self: matt, ruleItem: viper }), false);
  assert.equal(tags.get('self:maskBonded').fn('', { ruleItem: viper }), null);

  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(registerMaskTags(undefined), false);
  } finally {
    console.warn = warn;
  }
});

/* ---- The masks compendium (Phase 2) ---- */

const masksDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'packs', '_source', 'mask_masks');
const maskDocs = fs.readdirSync(masksDir).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(masksDir, file), 'utf8')));

test('every mask: flagged gear, off until worn, its helmet and the one-at-a-time Veto', () => {
  assert.equal(maskDocs.length, 53);
  for (const doc of maskDocs) {
    assert.equal(doc.type, 'gear', doc.name);
    assert.equal(doc.flags[MODULE_ID].mask, true, doc.name);
    assert.ok(doc.flags[MODULE_ID].agent, doc.name);
    assert.equal(doc.system.equipped, false, `${doc.name} must start unworn, so its first wearer bonds it`);
    const rules = doc.system.rules;
    assert.ok(rules.some(rule => rule.type == 'Defense' && rule.defense == 'toughness' && !rule.when), `${doc.name} helmet`);
    assert.ok(rules.some(rule => rule.type == 'Veto' && rule.on == 'equip' && rule.items.includes('item:mask')), `${doc.name} veto`);
    assert.ok(doc.system.automation?.status && doc.system.automation.notes, doc.name);
  }
});

test("every mask power: bonded wearer only, Speed uses per scene shared across the mask's buttons", () => {
  for (const doc of maskDocs) {
    const uses = doc.system.rules.filter(rule => rule.type == 'Use');
    assert.ok(uses.length, doc.name);
    const keys = new Set(uses.map(rule => rule.limit?.key));
    assert.equal(keys.size, 1, `${doc.name} shares one limit`);
    for (const rule of uses) {
      assert.ok(rule.when.includes('self:maskBonded'), `${doc.name}: ${rule.label}`);
      assert.deepEqual({ per: rule.limit.per, max: rule.limit.max }, { per: 'scene', max: '@essence.speed' });
      assert.ok(['standard', 'free', 'move'].includes(rule.cost?.action), `${doc.name}: ${rule.label}`);
    }

    for (const rule of doc.system.rules.filter(other => !['Use', 'Defense', 'Veto'].includes(other.type))) {
      assert.ok(rule.when?.includes('self:maskBonded'), `${doc.name}: its ${rule.type} is part of the power`);
    }
  }
});

/* ---- Vehicles and the Strike Mode templates (Phase 3) ---- */

const sourceDocs = pack => {
  const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'packs', '_source', pack);
  return fs.readdirSync(folder).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8')));
};
const STRIKE = 'self:marked:strikeMode';
const vehicleDocs = sourceDocs('mask_vehicles');

const rulesOfType = (doc, type) => doc.items.flatMap(item => item.system.rules.filter(rule => rule.type == type).map(rule => ({ item, rule })));
const strikeFeature = doc => doc.items.find(item => item.flags[MODULE_ID]?.strikeMode);

test('vehicles: every one in scope, actors with their own embedded items, Health as the starting Health, linked tokens', () => {
  assert.equal(vehicleDocs.length, 61);
  assert.equal(new Set(vehicleDocs.map(doc => doc.name)).size, vehicleDocs.length);
  for (const name of ['Thunderhawk', 'Rhino', 'Rhino ATV', 'Switchblade', 'Volcano', 'Goliath I', 'Goliath II', 'Outlaw', 'Manta', 'Hornet', 'Ratfang']) {
    assert.ok(vehicleDocs.some(doc => doc.name == name), name);
  }

  for (const doc of vehicleDocs) {
    assert.equal(doc.type, 'vehicle', doc.name);
    assert.ok(doc.system.health.origin > 0, `${doc.name}: non-PC Health lives in health.origin`);
    assert.equal(doc.system.defenses, undefined, `${doc.name}: Defenses come from base 10 + Essence`);
    assert.equal(doc.prototypeToken.actorLink, true, doc.name);
    assert.ok(doc.flags[MODULE_ID].agent, doc.name);
    for (const item of doc.items) {
      assert.equal(item._key, `!actors.items!${doc._id}.${item._id}`, `${doc.name}: ${item.name}`);
    }
  }
});

test('a converting vehicle: its Strike Mode feature marks and unmarks strikeMode, and holds only Strike Mode rules', () => {
  const converting = vehicleDocs.filter(strikeFeature);
  assert.equal(converting.length, 39);
  for (const doc of converting) {
    const feature = strikeFeature(doc);
    const uses = feature.system.rules.filter(rule => rule.type == 'Use');
    assert.deepEqual(uses.map(rule => rule.steps[0]), [{ do: 'mark', key: 'strikeMode' }, { do: 'unmark', key: 'strikeMode' }], doc.name);
    assert.deepEqual(uses.map(rule => rule.when), [[`not:${STRIKE}`], [STRIKE]], doc.name);
    for (const rule of feature.system.rules.filter(other => other.type != 'Use')) {
      assert.ok(rule.when.includes(STRIKE), `${doc.name}: ${rule.type}`);
    }
  }
});

test('weapons come out in Strike Mode on a converting vehicle, and are always ready on one that does not convert', () => {
  const eitherMode = new Set(['Nose Guns', 'Venom Cloud']);
  for (const doc of vehicleDocs) {
    const converts = !!strikeFeature(doc);
    for (const { item, rule } of rulesOfType(doc, 'Use')) {
      if (item.flags[MODULE_ID]?.strikeMode || /Bay$/.test(item.name) || eitherMode.has(rule.label)) {
        continue;
      }

      assert.equal(rule.when.includes(STRIKE), converts, `${doc.name}: ${rule.label}`);
    }
  }
});

test('linked mask powers need a working mask of that name aboard and are once per scene; every mask they name exists', () => {
  const maskNames = new Set(maskDocs.map(doc => doc.name));
  const linked = vehicleDocs.flatMap(doc => rulesOfType(doc, 'Use').filter(({ rule }) => rule.when?.some(tag => tag.startsWith('self:crewWearing:'))).map(entry => ({ ...entry, doc })));
  assert.ok(linked.length >= 40);
  for (const { doc, rule } of linked) {
    const mask = rule.when.find(tag => tag.startsWith('self:crewWearing:')).slice('self:crewWearing:'.length);
    assert.ok(maskNames.has(mask), `${doc.name}: ${mask}`);
    assert.deepEqual(rule.limit, { per: 'scene', max: 1 }, `${doc.name}: ${rule.label}`);
  }
});

test('every bay carries a vehicle that is in the compendium', () => {
  const names = new Set(vehicleDocs.map(doc => doc.name));
  for (const doc of vehicleDocs) {
    for (const item of doc.items.filter(other => / Bay$/.test(other.name))) {
      const carried = item.system.rules[0].label.replace(/^Deploy /, '');
      assert.ok(names.has(carried) || (doc.name == 'Rhino' && carried == 'ATV'), `${doc.name}: ${carried}`);
    }
  }
});

test('the Strike Mode templates are in the options compendium', () => {
  const names = sourceDocs('mask_options').filter(doc => doc.flags[MODULE_ID]?.template).map(doc => doc.name).sort();
  assert.deepEqual(names, ['Concealed Weapon (template)', 'Linked Mask Power (template)', 'Strike Mode (template)', 'Vehicle Bay (template)']);
});

/* ---- Origins and Mask Agent Perks (Phase 4) ---- */

const optionDocs = sourceDocs('mask_options');
const ESSENCES = ['strength', 'speed', 'smarts', 'social'];

test('every M.A.S.K. Origin grants its own Origin Perk from this compendium, with Essences, Skills, Health and movement', () => {
  const origins = optionDocs.filter(doc => doc.type == 'origin');
  assert.deepEqual(origins.map(doc => doc.name).sort(), ['Hired Gun', 'Inventor', 'Master of Disguise', 'Race Driver', 'Stunt Driver', 'Tycoon']);
  for (const doc of origins) {
    const s = doc.system;
    assert.ok(s.essences.length && s.essences.every(essence => ESSENCES.includes(essence)), doc.name);
    assert.ok(s.skills.length >= 3, doc.name);
    assert.ok(s.startingHealth >= 1 && s.baseGroundMovement >= 30, doc.name);
    const grants = Object.values(s.items);
    assert.equal(grants.length, 1, doc.name);
    const perk = optionDocs.find(other => grants[0].uuid == `Compendium.${MODULE_ID}.mask_options.Item.${other._id}`);
    assert.ok(perk, `${doc.name}: its granted Perk is in mask_options`);
    assert.equal(perk.type, 'perk');
    assert.equal(perk.system.type, 'origin', `${doc.name}: ${perk.name} is an Origin Perk`);
    assert.equal(grants[0].name, perk.name);
  }
});

test('every M.A.S.K. Perk: rules, automation notes, a homebrew source; Agent Perks are General', () => {
  const perks = optionDocs.filter(doc => doc.type == 'perk');
  assert.equal(perks.filter(doc => doc.system.type == 'origin').length, 6);
  const agent = perks.filter(doc => doc.flags[MODULE_ID]?.agentPerk);
  assert.deepEqual(agent.map(doc => doc.name).sort(), ['Hardened Mask', 'Quick Change', 'Secret Identity', 'Signature Mask', 'Vehicle Bond', 'Wheel Gunner']);
  for (const doc of perks) {
    assert.ok(doc.system.rules.length, doc.name);
    assert.ok(doc.system.automation?.status && doc.system.automation.notes, doc.name);
    assert.equal(doc.system.source.book, 'M.A.S.K. (homebrew)', doc.name);
  }

  for (const doc of agent) {
    assert.equal(doc.system.type, 'general', doc.name);
  }
});

test("Signature Mask reads the mask-power flag, which every mask attack carries and a vehicle's linked copy does not", () => {
  const signature = optionDocs.find(doc => doc.name == 'Signature Mask');
  assert.deepEqual(signature.system.rules[0].when, ['roll:dataset:maskPower']);
  const rolls = maskDocs.flatMap(doc => JSON.stringify(doc.system.rules).match(/"do":"rollVsEach"[^{}]*(\{[^{}]*\}[^{}]*)*\}/g) ?? []);
  assert.ok(rolls.length >= 30);
  for (const roll of rolls) {
    assert.ok(roll.includes('"dataset":{"maskPower":true}'), roll);
  }

  for (const doc of vehicleDocs) {
    assert.ok(!JSON.stringify(doc).includes('maskPower'), doc.name);
  }
});

test('Secret Identity: a Cover pool of 5 that the GM spends and lying low restores', () => {
  const rules = optionDocs.find(doc => doc.name == 'Secret Identity').system.rules;
  assert.deepEqual(rules.find(rule => rule.type == 'Pool'), { type: 'Pool', label: 'Cover', key: 'cover', max: 5, reset: 'none' });
  const [slips, lieLow] = rules.filter(rule => rule.type == 'Use');
  assert.deepEqual(slips.cost, { resource: { pool: 'cover' }, amount: 1 });
  assert.deepEqual(lieLow.limit, { per: 'mission', max: 1 });
  assert.ok(rules.find(rule => rule.type == 'RollModifier').when.includes('calc:@pool.cover>0'));
});
