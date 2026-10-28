/**
 * M.A.S.K. house rules (the M.A.S.K. plan, mask-work/MASK_PLAN.md §4). Off until the GM turns them on under Configure
 * Settings > House Rules, grouped under this module. Each rules one can be rebuilt by hand with New House Rule; the
 * switches are read by scripts/mask/mask-tags.mjs.
 *
 * Strike Mode is the `strikeMode` mark on a vehicle - set and cleared by the Use buttons on its Strike Mode feature
 * (the M.A.S.K. Origins, Perks and Features compendium).
 */

import { MODULE_ID } from '../house-rules.mjs';

/** Bonded Masks (a switch): a mask's power works only for the agent it's bonded to. Off: anyone can use any mask. */
export const BONDED_MASKS = `${MODULE_ID}-mask-bonded-masks`;

/** Concealed Weapons: a vehicle's Strike-only weapons (flags.<MODULE_ID>.strikeOnly on the attack) can't fire in Civilian Mode. */
export const CONCEALED_WEAPONS = `${MODULE_ID}-mask-concealed-weapons`;

/** The rules ones. */
export const MASK_RULE_HOUSE_RULES = [
  {
    // An early BeforeRoll cancel: refused before the action is paid (live-checked 2026-10-26).
    id: CONCEALED_WEAPONS,
    label: 'M.A.S.K.: Concealed Weapons',
    hint: "A vehicle's Strike-only weapons stay hidden in Civilian Mode and can't be fired until it converts.",
    default: true,
    rules: [{
      type: 'BeforeRoll',
      cancel: true,
      early: true,
      message: 'Hidden in Civilian Mode - convert to Strike Mode first.',
      when: ['self:type:vehicle', 'not:self:marked:strikeMode', `item:data:flags.${MODULE_ID}.strikeOnly=true`],
    }],
  },
  {
    id: `${MODULE_ID}-mask-disguised-vehicles`,
    label: 'M.A.S.K.: Disguised Vehicles',
    hint: 'A vehicle in Civilian Mode passes for ordinary traffic: Edge on its Deception and Infiltration tests.',
    rules: [{
      type: 'RollModifier',
      label: 'Disguised Vehicle (house rule)',
      edge: true,
      when: ['self:type:vehicle', 'not:self:marked:strikeMode', { any: ['skill:deception', 'skill:infiltration'] }],
    }],
  },
];

/** The switches - no rules of their own. */
export const MASK_SWITCH_HOUSE_RULES = [
  {
    id: BONDED_MASKS,
    label: 'M.A.S.K.: Bonded Masks',
    hint: "A mask's power works only for the agent it's bonded to - anyone else gets just the helmet. The GM rebonds a mask after lab work (the Rebond Mask macro). Off: anyone can use any mask.",
    default: true,
  },
];

/**
 * Register the M.A.S.K. house rules. Returns false on an Essence20 version without house rules.
 * @param {Object} api   game.essence20.rules
 */
export function registerMaskHouseRules(api) {
  if (typeof api?.registerHouseRule != 'function') {
    return false;
  }

  for (const houseRule of [...MASK_RULE_HOUSE_RULES, ...MASK_SWITCH_HOUSE_RULES]) {
    api.registerHouseRule({ ...houseRule, module: MODULE_ID });
  }

  return true;
}

globalThis.Hooks?.once?.('init', () => registerMaskHouseRules(globalThis.game?.essence20?.rules));
