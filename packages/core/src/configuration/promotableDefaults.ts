import { getSlotDefinition } from './slotFacade.ts'
import {
  getConf,
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from './util.ts'
import { deepEqual } from '../util/deepEqual.ts'
import { getSession } from '../util/index.ts'
import { getEnumerationValues } from '../util/mst-reflection.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationModel } from './types.ts'
import type { TrackConfigChange } from '../util/trackConfigDelta.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Session-wide "promoted defaults" for display-type config slots — a small CSS
 * cascade for one slot. A `promotable` slot resolves through three tiers:
 *
 *   pinned track value (differs from the slot default) -> session-wide promoted
 *   default for this display type -> the slot's base value
 *
 * A display marks a slot `promotable: true`, reads it with `getConfResolved`,
 * and the session store (`get/setDisplayTypeDefault`) holds the promoted value.
 * `stripDefault` collapses an at-default slot, so "un-pinned = at the slot
 * default" needs no stored flag. `resolveSlot` is the one place the cascade
 * lives; every exported function reads a field off it.
 *
 * Whether the default value itself is pinnable depends on the slot:
 *   - Plain (`showSoftClipping`): `defaultValue` is both the base and the
 *     inherit signal, so it can't be pinned over an opposite session default.
 *   - Sentinel (`displayMode`): `defaultValue` is a dedicated `'inherit'` member
 *     (CSS `inherit`) and `promotedBase` is what it resolves to (CSS `initial`),
 *     freeing every real value — base included — to be pinned.
 *
 * Every comparison below (pinned / at-default / at-promoted-default) uses
 * `deepEqual`, not `===`: needed once a promotable slot is `frozen`
 * (object-valued, e.g. alignments `colorBy`), where a fresh MST-reconstructed
 * value is never `===` the stored default.
 */

export type PromotableDisplay = IAnyStateTreeNode & {
  type: string
  configuration: AnyConfigurationModel
}

// The names of every promotable slot on a display's config schema (includes
// slots inherited via baseConfiguration — merged into the table at construction).
function promotableSlots(self: PromotableDisplay): string[] {
  const table = getConfigurationSchemaDefinition(self.configuration)
  return Object.entries(table ?? {})
    .filter(([, def]) => isSlotDefinitionEntry(def) && def.promotable)
    .map(([name]) => name)
}

/**
 * A stored promoted default is only usable when it could be a valid slot value:
 * same JS type as the slot default, and — for a `stringEnum` slot — one of the
 * enum's choices, and never the inherit sentinel itself, and — when the slot
 * declares one — passes its `validate` hook. Rejects a stale/garbage value left
 * in a saved preference so every consumer falls back in lockstep.
 */
function promotedUsable(def: ConfigSlotDefinition, promoted: unknown): boolean {
  const { type, model, defaultValue, promotedBase, validate } = def
  // a sentinel slot's own `defaultValue` (its `'inherit'` member) is never a
  // real value to inherit — only `promotedBase` and the other members are
  const isInheritSentinel =
    promotedBase !== undefined && deepEqual(promoted, defaultValue)
  const shapeOk =
    promoted === undefined || isInheritSentinel
      ? false
      : type === 'stringEnum' && model
        ? typeof promoted === 'string' &&
          getEnumerationValues(model).includes(promoted)
        : // a frozen/object slot (e.g. alignments `colorBy`): require a
          // non-null object of matching array-ness — `typeof promoted ===
          // typeof defaultValue` admits `null` (typeof null === 'object') and
          // an array against an object default
          typeof defaultValue === 'object' && defaultValue !== null
          ? typeof promoted === 'object' &&
            promoted !== null &&
            Array.isArray(promoted) === Array.isArray(defaultValue)
          : // `maybeNumber` is the only slot type allowed a `defaultValue` of
            // `undefined` (its "unset" state — see ConfigSlot); `typeof
            // promoted === typeof undefined` would reject every real value, so
            // validate against its actual value type (a number) instead
            defaultValue === undefined
            ? typeof promoted === 'number'
            : typeof promoted === typeof defaultValue
  return shapeOk && (!validate || validate(promoted))
}

interface SlotResolution {
  /** value an un-pinned track shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** track holds its own value rather than inheriting */
  pinned: boolean
  /** the raw session-wide promoted default, if any */
  promoted: unknown
  /** what an un-pinned track resolves to: promoted default if usable, else base */
  inherited: unknown
  /** the final cascaded value (never a slot's inherit sentinel) */
  value: unknown
}

// The whole three-tier cascade for one slot, in one place. Every exported
// function below just reads a field off this.
function resolveSlot(self: PromotableDisplay, slot: string): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  const base = def.promotedBase ?? def.defaultValue
  const own = getConf(self, slot)
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  const pinned = !deepEqual(own, def.defaultValue)
  const inherited = promotedUsable(def, promoted) ? promoted : base
  const value = pinned ? own : inherited
  return { base, pinned, promoted, inherited, value }
}

/**
 * #api core/configuration
 * Whether this track pins the slot (holds a non-default value) rather than
 * inheriting the session-wide promoted default.
 */
export function isSlotPinned(self: PromotableDisplay, slot: string): boolean {
  return resolveSlot(self, slot).pinned
}

/**
 * #api core/configuration
 * The value an un-pinned track resolves to for this slot — the session-wide
 * promoted default when usable, else the base — regardless of whether this track
 * currently pins its own value. Lets a track menu label its "follow default"
 * choice with the mode it would fall back to (e.g. `Default (Compact)`).
 */
export function getSlotInheritedValue<T = unknown>(
  self: PromotableDisplay,
  slot: string,
): T {
  return resolveSlot(self, slot).inherited as T
}

/**
 * #api core/configuration
 * Read a `promotable` slot, layering the session-wide promoted default under the
 * track's own value. Drop-in for `getConf` on the display's own promotable
 * slots, and always returns a real value (never a slot's inherit sentinel).
 * Main-thread only (consults the session) — the worker reads raw config.
 */
export function getConfResolved<T = unknown>(
  self: PromotableDisplay,
  slot: string,
): T {
  return resolveSlot(self, slot).value as T
}

/**
 * #api core/configuration
 * true when every listed slot's resolved value already equals its session-wide
 * promoted default — drives the track-menu "make default" checkbox.
 */
export function areSlotsAtSessionDefault(
  self: PromotableDisplay,
  slots: string[],
): boolean {
  return slots.every(slot => {
    const { promoted, value } = resolveSlot(self, slot)
    return promoted !== undefined && deepEqual(value, promoted)
  })
}

/**
 * #api core/configuration
 * Explicit setter for a group of slots' session-wide default: `promote` stores
 * each slot's current resolved value as the default for this display type;
 * `!promote` clears it so sibling tracks fall back to their own config. The
 * caller decides direction — pass `!areSlotsAtSessionDefault(...)` to toggle at
 * the point of use. Grouping (e.g. featureHeight + featureSpacing) keeps a
 * multi-slot setting behind one "make default" item.
 */
export function setSlotsSessionDefault(
  self: PromotableDisplay,
  slots: string[],
  promote: boolean,
): void {
  const session = getSession(self)
  for (const slot of slots) {
    session.setDisplayTypeDefault?.(
      self.type,
      slot,
      promote ? getConfResolved(self, slot) : undefined,
    )
  }
}

/**
 * #api core/configuration
 * Whether a *specific* value is the session-wide promoted default for this slot,
 * independent of the track's current value. Use for an always-visible "make this
 * the default for all tracks" control whose meaning is "promote this on-value"
 * (e.g. a per-mode toggle), rather than the value-dependent
 * `areSlotsAtSessionDefault` used by "promote whatever is current" controls.
 */
export function isSlotValueSessionDefault(
  self: PromotableDisplay,
  slot: string,
  value: unknown,
): boolean {
  return deepEqual(resolveSlot(self, slot).promoted, value)
}

/**
 * #api core/configuration
 * Promote a specific value as the session-wide default for this slot (`on`), or
 * clear the default (`!on`). Pair with `isSlotValueSessionDefault`.
 */
export function setSlotValueSessionDefault(
  self: PromotableDisplay,
  slot: string,
  value: unknown,
  on: boolean,
): void {
  getSession(self).setDisplayTypeDefault?.(
    self.type,
    slot,
    on ? value : undefined,
  )
}

/**
 * #api core/configuration
 * Effective differences an un-pinned track inherits from session-wide defaults,
 * one per promotable slot whose inherited value differs from its schema default.
 * Drives the track-selector "affected by a session default" badge.
 */
export function displaySessionDefaultChanges(
  self: PromotableDisplay,
): TrackConfigChange[] {
  return promotableSlots(self).flatMap(slot => {
    const { base, pinned, value } = resolveSlot(self, slot)
    return !pinned && !deepEqual(value, base)
      ? [{ path: [slot], from: base, to: value } as TrackConfigChange]
      : []
  })
}

/**
 * #api core/configuration
 * Clear every promoted default for this display type, so sibling tracks revert
 * to their own config values. Backs the badge's "clear default" action.
 */
export function clearDisplaySessionDefaults(self: PromotableDisplay): void {
  const session = getSession(self)
  for (const slot of promotableSlots(self)) {
    session.setDisplayTypeDefault?.(self.type, slot, undefined)
  }
}
