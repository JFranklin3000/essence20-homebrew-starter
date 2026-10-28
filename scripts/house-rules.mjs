/**
 * Example house rules (Essence20 6.0.7+). Each shows up under Configure Settings > House Rules, off until the GM turns
 * it on. Copy one, change its id (keep your module's id in front), its label and its rules, and you have your own.
 *
 * Two kinds:
 *  - Rules: `rules` holds ordinary item rules - the same JSON an item's Rules tab writes (see the Homebrew Guide,
 *    "Making it work: the Rules tab"). While the house rule is on, every character and Threat runs them.
 *  - Code: no `rules`; your own code checks houseRuleEnabled(id). Here, an essence20.preRollOptions listener that changes
 *    a roll just before its Roll Options Dialog opens.
 */

export const MODULE_ID = 'essence20-homebrew-starter';

/** The rules-only examples. */
export const RULE_HOUSE_RULES = [
  {
    id: `${MODULE_ID}-heroic-initiative`,
    label: 'Heroic Initiative',
    hint: 'Example: everyone rolls Initiative with an Edge - a faster, bolder start to every fight.',
    rules: [{ type: 'RollModifier', label: 'Heroic Initiative (house rule)', edge: true, when: ['skill:initiative'] }],
  },
  {
    id: `${MODULE_ID}-trained-initiative`,
    label: 'Everyone Knows Initiative',
    hint: "Example: Initiative never takes the untrained Snag, even at d20 - everyone's reflexes count.",
    rules: [{ type: 'RollModifier', label: 'Everyone Knows Initiative (house rule)', immune: ['untrainedSnag'], when: ['skill:initiative'] }],
  },
  {
    // LevelPick: a pick on top of the Role's own. Switched on mid-campaign, every character already past level 1 gets it
    // as a pending pick (the sheet's "Picks to make" button); switched off, unmade picks go and chosen Perks stay.
    // Add "when": ["self:line:pr"] (or self:level>=5...) to give it to only some characters.
    id: `${MODULE_ID}-extra-general-perk`,
    label: 'Extra General Perk',
    hint: 'Example: every character chooses one more General Perk at level 1, on top of their Role\'s.',
    rules: [{ type: 'LevelPick', kind: 'generalPerk', levels: ['1'] }],
  },
];

/** The code example: its id, read by stackingEdges. */
export const STACKING_EDGES = `${MODULE_ID}-stacking-edges`;

/**
 * Extra Edges and Snags count (the Power Rangers Living FAQ's reading): a roll with two or more Edge sources also gets ↑1,
 * and two or more Snag sources ↓1. Only the sources the Roll Options Dialog lists are counted (Perks, items, other house
 * rules), not a Skill's own Edge. Exported for tests.
 * @param {Object} payload   The essence20.preRollOptions payload.
 * @param {Function} enabled   houseRuleEnabled.
 */
export function stackingEdges(payload, enabled) {
  if (!enabled(STACKING_EDGES)) {
    return;
  }

  const edges = payload.sources.filter(source => source.edge).length;
  const snags = payload.sources.filter(source => source.snag).length;
  if (edges >= 2) {
    payload.addSource({ id: 'homebrew-extra-edge', label: 'Extra Edges (house rule)', shiftUp: 1 });
  }

  if (snags >= 2) {
    payload.addSource({ id: 'homebrew-extra-snag', label: 'Extra Snags (house rule)', shiftDown: 1 });
  }
}

/**
 * Register every example with the system's API. Returns false on an Essence20 version without house rules.
 * @param {Object} api   game.essence20.rules
 * @param {Object} [hooks]   Foundry's Hooks.
 */
export function registerExampleHouseRules(api, hooks = globalThis.Hooks) {
  if (typeof api?.registerHouseRule != 'function') {
    console.warn(`${MODULE_ID} | this Essence20 version has no house rules (6.0.7 or later needed) - the examples are skipped.`);
    return false;
  }

  for (const houseRule of RULE_HOUSE_RULES) {
    api.registerHouseRule({ ...houseRule, module: MODULE_ID });
  }

  api.registerHouseRule({
    id: STACKING_EDGES, module: MODULE_ID, label: 'Extra Edges and Snags Count',
    hint: 'Example (code): two or more Edges on a roll also give ↑1, and two or more Snags ↓1 - the Power Rangers Living FAQ\'s reading, where the core books say extras don\'t count.',
  });
  hooks?.on?.('essence20.preRollOptions', payload => stackingEdges(payload, api.houseRuleEnabled));
  return true;
}

// Foundry: register once the system has set up its API (its own init runs first).
globalThis.Hooks?.once?.('init', () => registerExampleHouseRules(globalThis.game?.essence20?.rules));
