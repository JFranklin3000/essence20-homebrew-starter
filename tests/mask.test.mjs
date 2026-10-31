import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_ID } from '../scripts/house-rules.mjs';

// M.A.S.K. (mask-work/MASK_PLAN.md), built on the system's Cartoon Kit features: a game line in module.json, Strike Mode
// as a vehicle Alt Mode, masks as bonded power gear. No module scripts of its own.

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'module.json'), 'utf8'));

test('the M.A.S.K. game line ships in module.json, built on G.I. Joe, its compendiums in the M.A.S.K. folder', () => {
  assert.deepEqual(manifest.flags.essence20.gameLines, [{ id: 'mask', label: 'M.A.S.K.', family: 'giJoe', packFolder: 'M.A.S.K.' }]);
  assert.ok(manifest.packFolders.some(folder => folder.name == 'M.A.S.K.'));
});

test('no M.A.S.K. scripts: the module loads only its house-rules examples', () => {
  assert.deepEqual(manifest.esmodules, ['scripts/house-rules.mjs']);
  assert.equal(fs.existsSync(path.join(root, 'scripts', 'mask')), false);
});

/* ---- The masks compendium (Phase 2) ---- */

const masksDir = path.join(root, 'packs', '_source', 'mask_masks');
const maskDocs = fs.readdirSync(masksDir).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(masksDir, file), 'utf8')));
const OLD_TAGS = /self:maskBonded|self:wearingItem|item:mask|self:crewWearing|strikeMode/;

test('every mask: bonded power gear in the mask slot, off until worn, with its helmet', () => {
  assert.equal(maskDocs.length, 53);
  for (const doc of maskDocs) {
    assert.equal(doc.type, 'gear', doc.name);
    assert.equal(doc.flags[MODULE_ID].mask, true, doc.name);
    assert.ok(doc.flags[MODULE_ID].agent, doc.name);
    assert.deepEqual(doc.system.powerGear, { bonded: true, bondedTo: '', slot: 'mask', altModeOnly: false }, doc.name);
    assert.equal(doc.system.equipped, false, `${doc.name} must start unworn, so its first wearer bonds it`);
    const rules = doc.system.rules;
    assert.ok(rules.some(rule => rule.type == 'Defense' && rule.defense == 'toughness' && !rule.when), `${doc.name} helmet`);
    assert.ok(!rules.some(rule => rule.type == 'Veto'), `${doc.name}: the slot takes off the other mask`);
    assert.ok(doc.system.automation?.status && doc.system.automation.notes, doc.name);
  }
});

test("every mask power: Speed uses per scene shared across the mask's buttons, no old tags", () => {
  for (const doc of maskDocs) {
    const uses = doc.system.rules.filter(rule => rule.type == 'Use');
    assert.ok(uses.length, doc.name);
    const keys = new Set(uses.map(rule => rule.limit?.key));
    assert.equal(keys.size, 1, `${doc.name} shares one limit`);
    for (const rule of uses) {
      assert.deepEqual({ per: rule.limit.per, max: rule.limit.max }, { per: 'scene', max: '@essence.speed' });
      assert.ok(['standard', 'free', 'move'].includes(rule.cost?.action), `${doc.name}: ${rule.label}`);
    }

    assert.doesNotMatch(JSON.stringify(doc.system.rules), OLD_TAGS, doc.name);
  }
});

/* ---- Vehicles and the Strike Mode templates (Phase 3) ---- */

const sourceDocs = pack => {
  const folder = path.join(root, 'packs', '_source', pack);
  return fs.readdirSync(folder).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(folder, file), 'utf8')));
};
const vehicleDocs = sourceDocs('mask_vehicles');

const rulesOfType = (doc, type) => doc.items.flatMap(item => item.system.rules.filter(rule => rule.type == type).map(rule => ({ item, rule })));
const strikeFeature = doc => doc.items.find(item => item.type == 'altMode');
const strikeOnly = item => !!item.system.powerGear?.altModeOnly;

test('vehicles: every one in scope, actors with their own embedded items, Health as the starting Health, linked tokens', () => {
  assert.equal(vehicleDocs.length, 62);
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
    assert.doesNotMatch(JSON.stringify(doc.items.map(item => item.system.rules)), OLD_TAGS, doc.name);
    for (const item of doc.items) {
      assert.equal(item._key, `!actors.items!${doc._id}.${item._id}`, `${doc.name}: ${item.name}`);
    }
  }
});

test("a converting vehicle: one Strike Mode Alt Mode, at the vehicle's size, keeping its Civilian movement, with Disguised Vehicle", () => {
  const converting = vehicleDocs.filter(strikeFeature);
  assert.equal(converting.length, 40);
  const ALT = { swim: 'aquatic' };
  for (const doc of converting) {
    const modes = doc.items.filter(item => item.type == 'altMode');
    assert.equal(modes.length, 1, doc.name);
    const [mode] = modes;
    assert.ok(mode.name.startsWith('Strike Mode: '), doc.name);
    assert.equal(mode.system.altModesize, doc.system.size, doc.name);
    assert.deepEqual(mode.system.altModeSizeOptions, [doc.system.size], doc.name);
    for (const [type, { base }] of Object.entries(doc.system.movement)) {
      assert.ok(mode.system.altModeMovement[ALT[type] ?? type] >= base, `${doc.name}: ${type}`);
    }

    const { toughness, evasion } = mode.system.modeDefenses;
    assert.ok(toughness > 0 || evasion > 0 || Object.values(mode.system.altModeMovement).some(Boolean), doc.name);
    assert.deepEqual(mode.system.rules, [{ type: 'RollModifier', label: 'Disguised Vehicle', edge: true, when: ['not:self:transformed', { any: ['skill:deception', 'skill:infiltration'] }] }], doc.name);
  }
});

test('weapons come out in Strike Mode on a converting vehicle (Alt Mode only), and are always ready on one that does not convert', () => {
  const eitherMode = new Set(['Nose Guns', 'Viper Dispersal']);
  for (const doc of vehicleDocs) {
    const converts = !!strikeFeature(doc);
    for (const item of doc.items.filter(other => other.type == 'upgrade' && other.system.rules.some(rule => rule.type == 'Use'))) {
      if (item.flags[MODULE_ID]?.hq || /Bay$/.test(item.name) || eitherMode.has(item.name)) {
        assert.equal(strikeOnly(item), false, `${doc.name}: ${item.name}`);
        continue;
      }

      assert.equal(strikeOnly(item), converts, `${doc.name}: ${item.name}`);
    }
  }
});

test('linked mask powers need that mask worn aboard (by slot and name) and are once per scene; every mask they name exists', () => {
  const maskNames = new Set(maskDocs.map(doc => doc.name));
  const TAG = 'self:crewSlotEquipped:mask:';
  const linked = vehicleDocs.flatMap(doc => rulesOfType(doc, 'Use').filter(({ rule }) => rule.when?.some(tag => tag.startsWith(TAG))).map(entry => ({ ...entry, doc })));
  assert.ok(linked.length >= 40);
  for (const { doc, rule } of linked) {
    const mask = rule.when.find(tag => tag.startsWith(TAG)).slice(TAG.length);
    assert.ok(maskNames.has(mask), `${doc.name}: ${mask}`);
    assert.deepEqual(rule.limit, { per: 'scene', max: 1 }, `${doc.name}: ${rule.label}`);
  }
});

test('every bay carries a vehicle that is in the compendium', () => {
  const names = new Set(vehicleDocs.map(doc => doc.name));
  for (const doc of vehicleDocs) {
    for (const item of doc.items.filter(other => / Bay$/.test(other.name) && !other.flags[MODULE_ID]?.hq)) {
      const carried = item.system.rules[0].label.replace(/^Deploy /, '');
      assert.ok(names.has(carried) || (doc.name == 'Rhino' && carried == 'ATV'), `${doc.name}: ${carried}`);
    }
  }
});

test('the Strike Mode templates are in the options compendium: an Alt Mode, and Strike-only upgrades', () => {
  const templates = sourceDocs('mask_options').filter(doc => doc.flags[MODULE_ID]?.template);
  assert.deepEqual(templates.map(doc => doc.name).sort(), ['Concealed Weapon (template)', 'Linked Mask Power (template)', 'Strike Mode (template)', 'Vehicle Bay (template)']);
  const byName = Object.fromEntries(templates.map(doc => [doc.name, doc]));
  assert.equal(byName['Strike Mode (template)'].type, 'altMode');
  assert.equal(strikeOnly(byName['Concealed Weapon (template)']), true);
  assert.equal(strikeOnly(byName['Linked Mask Power (template)']), true);
  assert.equal(strikeOnly(byName['Vehicle Bay (template)']), false);
  assert.doesNotMatch(JSON.stringify(templates.map(doc => doc.system.rules)), OLD_TAGS);
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

/* ---- Agents and V.E.N.O.M. (Phase 5) ---- */

const agentDocs = sourceDocs('mask_agents');
const venomDocs = sourceDocs('mask_venom');

test('the agent roster: every named agent of both sides, Threat Builder NPCs on the right side and pack', () => {
  assert.equal(agentDocs.length, 17);
  assert.equal(venomDocs.length, 11);
  for (const [docs, side, disposition] of [[agentDocs, 'mask', 1], [venomDocs, 'venom', -1]]) {
    for (const doc of docs) {
      assert.equal(doc.type, 'npc', doc.name);
      assert.equal(doc.flags[MODULE_ID].side, side, doc.name);
      assert.equal(doc.prototypeToken.disposition, disposition, doc.name);
      assert.equal(doc.flags.essence20.threatBuild.ruleset, 'fieldGuide', doc.name);
      assert.ok(doc.system.threatLevel >= 0 && doc.system.health.origin >= 1, doc.name);
      assert.ok(doc.items.some(item => item.type == 'weapon'), `${doc.name} has an attack`);
      for (const item of doc.items) {
        assert.equal(item._key, `!actors.items!${doc._id}.${item._id}`, `${doc.name}: ${item.name}`);
      }
    }
  }

  // Every agent a mask or a vehicle names is on the roster.
  const named = new Set([...agentDocs, ...venomDocs].map(doc => doc.name));
  for (const doc of [...maskDocs, ...vehicleDocs]) {
    for (const agent of String(doc.flags[MODULE_ID].agent).split(' & ')) {
      assert.ok(named.has(agent), `${doc.name}: ${agent}`);
    }
  }
});

test("an agent wears one mask, bonded to them, and every mask of theirs is that mask's own agent's", () => {
  for (const doc of [...agentDocs, ...venomDocs]) {
    const masks = doc.items.filter(item => item.flags?.[MODULE_ID]?.mask);
    if (!masks.length) {
      continue;
    }

    assert.equal(masks.filter(item => item.system.equipped).length, 1, doc.name);
    for (const mask of masks) {
      assert.equal(mask.system.powerGear.bondedTo, doc._id, `${doc.name}: ${mask.name}`);
      assert.equal(mask.flags[MODULE_ID].bondedTo, undefined, `${doc.name}: ${mask.name} - the old module-flag bond`);
      assert.equal(mask.flags[MODULE_ID].agent, doc.name, `${doc.name}: ${mask.name}`);
    }
  }
});

test("a weapon's effect is its own, by parent id", () => {
  for (const doc of [...agentDocs, ...venomDocs]) {
    for (const effect of doc.items.filter(item => item.type == 'weaponEffect')) {
      const weapon = doc.items.find(item => item._id == effect.flags.essence20.parentId);
      assert.ok(weapon?.type == 'weapon', `${doc.name}: ${effect.name}`);
      assert.ok(Object.values(weapon.system.items).some(entry => entry.uuid.endsWith(`.Item.${effect._id}`)), `${doc.name}: ${effect.name}`);
    }
  }
});

test('agent Perks are copies of the M.A.S.K. Perks', () => {
  const perkNames = new Set(optionDocs.filter(doc => doc.type == 'perk').map(doc => doc.name));
  for (const doc of [...agentDocs, ...venomDocs]) {
    for (const perk of doc.items.filter(item => item.type == 'perk')) {
      assert.ok(perkNames.has(perk.name), `${doc.name}: ${perk.name}`);
    }
  }
});

/* ---- Campaign pieces (Phase 6) ---- */

const tableDocs = sourceDocs('mask_tables').filter(doc => doc._key.startsWith('!tables!'));
const tableFolders = sourceDocs('mask_tables').filter(doc => doc._key.startsWith('!folders!'));

test('the heist and race tables: contiguous ranges that fill their formula, crew results naming V.E.N.O.M. actors', () => {
  assert.deepEqual(tableDocs.filter(doc => doc.flags[MODULE_ID]?.heist).map(doc => doc.flags[MODULE_ID].heist).sort(),
    ['complication', 'crew', 'disguise', 'location', 'scheme', 'target']);
  assert.deepEqual(tableDocs.filter(doc => doc.flags[MODULE_ID]?.race).map(doc => doc.flags[MODULE_ID].race).sort(), ['course', 'hazard']);
  const venomIds = new Set(venomDocs.map(doc => doc._id));
  for (const doc of tableDocs) {
    let next = 1;
    for (const result of doc.results) {
      assert.equal(result.range[0], next, `${doc.name}: ${result.name}`);
      assert.equal(result.range[1] - result.range[0] + 1, result.weight, `${doc.name}: ${result.name}`);
      assert.equal(result._key, `!tables.results!${doc._id}.${result._id}`);
      next = result.range[1] + 1;
      if (result.type == 'document') {
        const id = result.documentUuid.split('.').at(-1);
        assert.ok(result.documentUuid.startsWith(`Compendium.${MODULE_ID}.mask_venom.Actor.`) && venomIds.has(id), `${doc.name}: ${result.name}`);
      }
    }

    assert.equal(doc.formula, `1d${next - 1}`, doc.name);
  }
});

test('the episode folders: each kind of table in order, with a title and outline for the Mission Generator - no macros', () => {
  assert.deepEqual(tableFolders.map(folder => folder.name).sort(), ['Racing Season', 'V.E.N.O.M. Heist']);
  for (const folder of tableFolders) {
    const kind = folder.flags[MODULE_ID].episode;
    assert.equal(folder.type, 'RollTable');
    const tables = tableDocs.filter(doc => doc.flags[MODULE_ID]?.[kind]);
    assert.ok(tables.length >= 2, folder.name);
    assert.ok(tables.every(doc => doc.folder == folder._id), folder.name);
    assert.equal(new Set(tables.map(doc => doc.sort)).size, tables.length, `${folder.name}: one place each`);
    // Every {placeholder} in its title and outline names one of its tables.
    const { title, outline } = folder.flags.essence20.mission;
    const key = name => name.toLowerCase().replace(/\s+/g, '');
    const names = new Set(tables.map(doc => key(doc.name)));
    for (const [, name] of `${title}\n${outline}`.matchAll(/\{([^{}]+)\}/g)) {
      assert.ok(names.has(key(name)), `${folder.name}: {${name}}`);
    }
  }

  assert.deepEqual(tableDocs.filter(doc => doc.flags[MODULE_ID]?.heist).sort((a, b) => a.sort - b.sort).map(doc => doc.name),
    ['Prize', 'Location', 'Scheme', 'Cover', 'Crew', 'Complication']);
  assert.ok(!fs.existsSync(path.join(root, 'packs', '_source', 'mask_macros')));
  assert.ok(!manifest.packs.some(pack => pack.name == 'mask_macros'));
});

test('Boulder Hill: a headquarters with its HQ facilities', () => {
  const base = vehicleDocs.find(doc => doc.name == 'Boulder Hill');
  assert.ok(strikeFeature(base));
  assert.deepEqual(base.items.filter(item => item.flags[MODULE_ID]?.hq).map(item => item.name).sort(), ['Command Center', 'Hidden Hangar', 'Mask Lab', 'Repair Bay']);
  const command = base.items.find(item => item.name == 'Command Center').system.rules[0];
  assert.equal(command.scope, 'crew');
});

/* ---- The Mask Agent Role (Phase 7) ---- */

test('the Mask Agent Role: G.I. Joe-shaped - 20 Essence increases (two at 1st, none at 10th), five General Perks', () => {
  const role = optionDocs.find(doc => doc.type == 'role');
  assert.equal(role.name, 'Mask Agent');
  assert.equal(role.system.version, 'giJoe');
  assert.equal(role.system.gameLine, 'mask');
  const counts = {};
  for (const levels of Object.values(role.system.essenceLevels)) {
    for (const level of levels) counts[level] = (counts[level] ?? 0) + 1;
  }

  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 20);
  assert.equal(counts.level1, 2);
  assert.equal(counts.level10, undefined);
  assert.deepEqual(role.system.perkLevels.general, ['level4', 'level8', 'level12', 'level16', 'level19']);
});

test("the Role's grants resolve: its own Perks and Mask Charge in this compendium, Extra Attack in the system's", () => {
  const role = optionDocs.find(doc => doc.type == 'role');
  const ids = new Map(optionDocs.map(doc => [`Compendium.${MODULE_ID}.mask_options.Item.${doc._id}`, doc]));
  const grants = Object.values(role.system.items);
  assert.equal(grants.filter(item => item.type == 'rolePoints').length, 1);
  for (const item of grants) {
    if (item.uuid.startsWith('Compendium.essence20.')) {
      assert.equal(item.name, 'Extra Attack');
      continue;
    }

    const doc = ids.get(item.uuid);
    assert.ok(doc, item.name);
    assert.equal(doc.name, item.name);
    assert.equal(doc.type, item.type);
    if (item.type == 'perk') {
      assert.ok(item.level >= 1 && item.level <= 20, item.name);
      assert.equal(item.subtype, doc.system.type == 'role' ? 'role' : 'general', item.name);
    }
  }

  assert.deepEqual(grants.filter(item => item.type == 'perk').map(item => item.level), [1, 1, 2, 3, 5, 7, 9, 11, 13, 14, 15, 18, 20]);
  for (const doc of optionDocs.filter(other => other.flags[MODULE_ID]?.rolePerk)) {
    assert.equal(doc.system.type, 'role', doc.name);
  }
});
