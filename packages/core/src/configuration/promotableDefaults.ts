import { getType } from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { getSlotDefinition } from './slotFacade.ts'
import { getConf, isSlotDefinitionEntry } from './util.ts'
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
 */

export type PromotableDisplay = IAnyStateTreeNode & {
  type: string
  configuration: AnyConfigurationModel
}

// The names of every promotable slot on a display's config schema (includes
// slots inherited via baseConfiguration — merged into the table at construction).
function promotableSlots(self: PromotableDisplay): string[] {
  const table = getConfigurationSchemaMetadata(
    getType(self.configuration),
  )?.definition
  return Object.entries(table ?? {})
    .filter(([, def]) => isSlotDefinitionEntry(def) && def.promotable)
    .map(([name]) => name)
}

/**
 * A stored promoted default is only usable when it could be a valid slot value:
 * same JS type as the slot default, and — for a `stringEnum` slot — one of the
 * enum's choices, and never the inherit sentinel itself. Rejects a stale/garbage
 * value left in a saved preference so every consumer falls back in lockstep.
 */
function promotedUsable(def: ConfigSlotDefinition, promoted: unknown): boolean {
  const { type, model, defaultValue, promotedBase } = def
  if (promoted === undefined) {
    return false
  }
  // a sentinel slot's own `defaultValue` (its `'inherit'` member) is never a
  // real value to inherit — only `promotedBase` and the other members are
  if (promotedBase !== undefined && promoted === defaultValue) {
    return false
  }
  return type === 'stringEnum' && model
    ? typeof promoted === 'string' &&
        getEnumerationValues(model).includes(promoted)
    : typeof promoted === typeof defaultValue
}

interface SlotResolution {
  /** value an un-pinned track shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** track holds its own value rather than inheriting */
  pinned: boolean
  /** the raw session-wide promoted default, if any */
  promoted: unknown
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
  const pinned = own !== def.defaultValue
  const value = pinned ? own : promotedUsable(def, promoted) ? promoted : base
  return { base, pinned, promoted, value }
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
    return promoted !== undefined && value === promoted
  })
}

/**
 * #api core/configuration
 * Promote each listed slot's current resolved value to the session-wide default,
 * or clear them when they already are the default (a single toggle for a group
 * of slots, e.g. featureHeight + featureSpacing behind one "make default" item).
 */
export function toggleSlotsSessionDefault(
  self: PromotableDisplay,
  slots: string[],
): void {
  const session = getSession(self)
  const clearing = areSlotsAtSessionDefault(self, slots)
  for (const slot of slots) {
    session.setDisplayTypeDefault?.(
      self.type,
      slot,
      clearing ? undefined : getConfResolved(self, slot),
    )
  }
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
    return !pinned && value !== base
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
