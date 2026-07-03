import { getType } from '@jbrowse/mobx-state-tree'

import { getConfigurationSchemaMetadata } from './schemaRegistry.ts'
import { getSlotDefinition } from './slotFacade.ts'
import { getConf, isSlotDefinitionEntry } from './util.ts'
import { getSession } from '../util/index.ts'

import type { AnyConfigurationModel } from './types.ts'
import type { TrackConfigChange } from '../util/trackConfigDelta.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Session-wide "promoted defaults" for display-type config slots.
 *
 * A slot flagged `promotable` in its schema resolves through three tiers:
 *
 *   this track's own value (if it differs from the slot default = "pinned")
 *     -> the user's session-wide default for this display type
 *     -> the slot's schema default
 *
 * "un-pinned = at the slot default" is the whole rule, read straight off the
 * config schema (`types.stripDefault` already collapses an at-default slot).
 * There is no per-display resolution code, no tri-state slot, and no migration:
 * a display marks a slot `promotable: true`, reads it with `getConfResolved`,
 * and the session store (`get/setDisplayTypeDefault`) holds the promoted value.
 *
 * The accepted trade-off (uniform across every promotable slot): a slot can't
 * pin its own default value back over an opposite session default, because that
 * value is the "inherit" signal — e.g. with a compact session default, a track
 * can't hold `showSoftClipping: false` or `displayMode: 'normal'`.
 */

type DisplaySelf = IAnyStateTreeNode & {
  type: string
  configuration: AnyConfigurationModel
}

// The names of every promotable slot on a display's config schema (includes
// slots inherited via baseConfiguration — merged into the table at construction).
function promotableSlots(self: DisplaySelf): string[] {
  const table = getConfigurationSchemaMetadata(
    getType(self.configuration),
  )?.definition
  return Object.entries(table ?? {})
    .filter(([, def]) => isSlotDefinitionEntry(def) && def.promotable)
    .map(([name]) => name)
}

function slotDefault(self: DisplaySelf, slot: string): unknown {
  return getSlotDefinition(self.configuration, slot).defaultValue
}

/**
 * #api core/configuration
 * Read a `promotable` slot, layering the session-wide promoted default under the
 * track's own value. Drop-in for `getConf` on the display's own promotable
 * slots. Main-thread only (consults the session) — the worker reads raw config.
 */
export function getConfResolved<T = unknown>(
  self: DisplaySelf,
  slot: string,
): T {
  const value = getConf(self, slot)
  const def = slotDefault(self, slot)
  if (value !== def) {
    return value
  } else {
    // un-pinned (at the slot default): use the promoted default when present and
    // of the slot's type (a stale/garbage stored value is ignored -> default)
    const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
    return (typeof promoted === typeof def ? promoted : def) as T
  }
}

/**
 * #api core/configuration
 * true when every listed slot's resolved value already equals its session-wide
 * promoted default — drives the track-menu "make default" checkbox.
 */
export function areSlotsAtSessionDefault(
  self: DisplaySelf,
  slots: string[],
): boolean {
  const session = getSession(self)
  return slots.every(slot => {
    const promoted = session.getDisplayTypeDefault?.(self.type, slot)
    return promoted !== undefined && getConfResolved(self, slot) === promoted
  })
}

/**
 * #api core/configuration
 * Promote each listed slot's current resolved value to the session-wide default,
 * or clear them when they already are the default (a single toggle for a group
 * of slots, e.g. featureHeight + featureSpacing behind one "make default" item).
 */
export function toggleSlotsSessionDefault(
  self: DisplaySelf,
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
  self: DisplaySelf,
): TrackConfigChange[] {
  return promotableSlots(self).flatMap(slot => {
    const def = slotDefault(self, slot)
    const resolved = getConfResolved(self, slot)
    const pinned = getConf(self, slot) !== def
    return !pinned && resolved !== def
      ? [{ path: [slot], from: def, to: resolved } as TrackConfigChange]
      : []
  })
}

/**
 * #api core/configuration
 * Clear every promoted default for this display type, so sibling tracks revert
 * to their own config values. Backs the badge's "clear default" action.
 */
export function clearDisplaySessionDefaults(self: DisplaySelf): void {
  const session = getSession(self)
  for (const slot of promotableSlots(self)) {
    session.setDisplayTypeDefault?.(self.type, slot, undefined)
  }
}
