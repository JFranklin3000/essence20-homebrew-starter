/**
 * M.A.S.K. rule tags and mask bonds (the M.A.S.K. plan, mask-work/MASK_PLAN.md §3, gaps G1 and G3). Only the system's
 * public API - game.essence20.rules.registerTag - and Foundry's own hooks; nothing is imported from the system.
 *
 * A mask is gear with `flags.<MODULE_ID>.mask: true`; its bond is `flags.<MODULE_ID>.bondedTo`, the wearer's actor id
 * (a token's actor shares its base actor's id, so every token of a V.E.N.O.M. agent wears its masks).
 *
 * Tags, for the `when` of a mask's or a vehicle's rules:
 *   item:mask              the item is a mask (a mask's "one at a time" Veto: {on: 'equip', items: ['item:mask']},
 *                          when ['self:wearingItem:item:mask'])
 *   self:maskBonded        the rule's mask works for this actor: bonded to it, not bonded yet, or Bonded Masks is off.
 *                          A mask's power rules carry it; its helmet rules don't.
 *   self:crewWearing[:<n>] someone crewing this vehicle wears a mask that works for them, named <n> if given (a linked
 *                          mask: Thunderhawk's Spectrum firepoint).
 *
 * Bonds: an unbonded mask bonds to whoever puts it on; a new actor (imported from a compendium, duplicated) is its own
 * masks' wearer. Rebonding to someone else is the GM's Rebond Mask macro (rebondMask).
 */

import { MODULE_ID } from '../house-rules.mjs';
import { BONDED_MASKS } from './house-rules.mjs';

const itemsOf = actor => actor?.items?.contents ?? (actor?.items ? [...actor.items] : []);

/** Whether an item is a mask. */
export function isMask(item) {
  return item?.type == 'gear' && item.flags?.[MODULE_ID]?.mask === true;
}

/** The actor id a mask is bonded to, or ''. */
export const bondOf = item => item?.flags?.[MODULE_ID]?.bondedTo ?? '';

/**
 * Whether a mask works for an actor: not a mask, no bond yet, bonded to it - or the Bonded Masks house rule is off.
 * @param {Item} item
 * @param {Actor} actor
 * @param {Function} [enabled]   houseRuleEnabled.
 */
export function bondHolds(item, actor, enabled = () => true) {
  if (!isMask(item) || !enabled(BONDED_MASKS)) {
    return true;
  }

  const bondedTo = bondOf(item);
  return !bondedTo || !actor?.id || bondedTo == actor.id;
}

/** Whether someone crewing this vehicle wears a mask that works for them (named like `name`, when given). */
export function crewWearing(vehicle, name = '', { resolve = uuid => globalThis.fromUuidSync?.(uuid) ?? null, enabled } = {}) {
  const wanted = String(name ?? '').trim().toLowerCase();
  return Object.values(vehicle?.system?.actors ?? {}).filter(entry => entry?.uuid).map(entry => resolve(entry.uuid)).filter(Boolean)
    .some(crew => itemsOf(crew).some(item => isMask(item) && item.system?.equipped !== false && bondHolds(item, crew, enabled)
      && (!wanted || String(item.name ?? '').toLowerCase().includes(wanted))));
}

/** The mask updates that make a new actor its own masks' wearer. */
export function rebondAllUpdates(actor) {
  return itemsOf(actor).filter(item => isMask(item) && bondOf(item) && bondOf(item) != actor.id)
    .map(item => ({ _id: item.id, [`flags.${MODULE_ID}.bondedTo`]: actor.id }));
}

/** preUpdateItem: an unbonded mask being put on bonds to its wearer (written into the same update). */
export function bondOnEquip(item, changes) {
  if (!isMask(item) || !item.parent || changes?.system?.equipped !== true || bondOf(item)) {
    return;
  }

  changes.flags ??= {};
  changes.flags[MODULE_ID] = { ...(changes.flags[MODULE_ID] ?? {}), bondedTo: item.parent.id };
}

/** The GM rebonds a mask to whoever holds it now (or clears the bond). */
export async function rebondMask(item, { clear = false } = {}) {
  if (!isMask(item) || !globalThis.game?.user?.isGM) {
    return null;
  }

  return item.update({ [`flags.${MODULE_ID}.bondedTo`]: clear ? '' : (item.parent?.id ?? '') });
}

/**
 * Register the tags. Returns false on an Essence20 version without the public rules API.
 * @param {Object} api   game.essence20.rules
 */
export function registerMaskTags(api) {
  if (typeof api?.registerTag != 'function') {
    console.warn(`${MODULE_ID} | this Essence20 version has no public rules API - the M.A.S.K. tags are skipped.`);
    return false;
  }

  const enabled = id => api.houseRuleEnabled?.(id) ?? true;
  api.registerTag('item:mask', (_rest, ctx) => isMask(ctx.item), { phrase: ['it is a mask', "it isn't a mask"] });
  api.registerTag('self:maskBonded', (_rest, ctx) => (ctx.self ? bondHolds(ctx.ruleItem, ctx.self, enabled) : null), {
    phrase: ['{who} {is} bonded to this mask', "{who} {isnt} bonded to this mask"],
  });
  api.registerTag('self:crewWearing', (rest, ctx) => (ctx.self ? crewWearing(ctx.self, rest, { enabled }) : null), {
    phrase: arg => [`someone aboard is wearing ${arg ? `the ${arg} mask` : 'a mask'}`, `nobody aboard is wearing ${arg ? `the ${arg} mask` : 'a mask'}`],
  });
  return true;
}

const mine = userId => userId == globalThis.game?.user?.id;

globalThis.Hooks?.once?.('init', () => {
  registerMaskTags(globalThis.game?.essence20?.rules);
  globalThis.Hooks.on('preUpdateItem', (item, changes) => bondOnEquip(item, changes));
  globalThis.Hooks.on('createActor', async (actor, _options, userId) => {
    const updates = mine(userId) ? rebondAllUpdates(actor) : [];
    if (updates.length) {
      await actor.updateEmbeddedDocuments('Item', updates);
    }
  });
  // For the Rebond Mask macro (the M.A.S.K. Macros compendium).
  const module = globalThis.game?.modules?.get?.(MODULE_ID);
  if (module) {
    module.api = { ...(module.api ?? {}), mask: { rebondMask, bondHolds, isMask } };
  }
});
