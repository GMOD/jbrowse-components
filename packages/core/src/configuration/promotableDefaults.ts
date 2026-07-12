import { getSlotDefinition } from './slotFacade.ts'
import {
  getConf,
  getConfSnapshot,
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
} from './util.ts'
import { deepEqual } from '../util/deepEqual.ts'
import { getSession, isViewContainer } from '../util/index.ts'
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
 * Whether a stored value could really be a value of this slot — the single
 * gate both cascade tiers pass a candidate through: a session-wide promoted
 * default, and a track's own value read from an untyped saved snapshot. Three
 * independent checks, each obviously correct on its own:
 *   1. it's a concrete value, not "inherit" (`isConcreteValue`),
 *   2. its JS shape fits the slot (`matchesSlotShape`),
 *   3. it passes the slot's optional semantic `validate` hook.
 * An unusable value is dropped so every consumer falls back in lockstep.
 */
function isUsableValue(def: ConfigSlotDefinition, value: unknown): boolean {
  const { validate } = def
  return (
    isConcreteValue(def, value) &&
    matchesSlotShape(def, value) &&
    (!validate || validate(value))
  )
}

// A real value to use, versus the two ways a stored value means "no value —
// inherit": `undefined` (an unset/stripped slot), or a sentinel slot's own
// `defaultValue` (its `'inherit'` member — only `promotedBase` and the other
// members are real values there).
function isConcreteValue(def: ConfigSlotDefinition, value: unknown): boolean {
  const { defaultValue, promotedBase } = def
  const isInheritSentinel =
    promotedBase !== undefined && deepEqual(value, defaultValue)
  return value !== undefined && !isInheritSentinel
}

// Whether `value` has a JS shape this slot could hold. Guards the untyped
// session store / saved snapshot against garbage; not a full validation
// (`validate` layers semantics on top). Derived from the slot's own metadata so
// a new promotable slot type needs no change here.
function matchesSlotShape(def: ConfigSlotDefinition, value: unknown): boolean {
  const { type, model, defaultValue } = def
  return type === 'stringEnum' && model
    ? typeof value === 'string' && getEnumerationValues(model).includes(value)
    : // `maybeNumber`/`maybeBoolean` default to `undefined` (their "unset"
      // state — see ConfigSlot), so their shape is keyed on the declared `type`,
      // not `defaultValue` — `typeof value === typeof undefined` would reject
      // every real value
      type === 'maybeNumber'
      ? typeof value === 'number'
      : type === 'maybeBoolean'
        ? typeof value === 'boolean'
        : typeof defaultValue === 'object' && defaultValue !== null
          ? // object/array slot (e.g. `colorBy`): match null-ness and array-ness
            // — `typeof value === typeof defaultValue` would admit `null` (typeof
            // null === 'object') and an array against an object default
            typeof value === 'object' &&
            value !== null &&
            Array.isArray(value) === Array.isArray(defaultValue)
          : typeof value === typeof defaultValue
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
  // A track pins only when it holds a *usable* value other than the default.
  // Routing `own` through the same `isUsableValue` gate as a promoted default
  // means an own value that's malformed or fails `validate` (e.g. a saved
  // `colorBy` naming a since-removed scheme) reads as un-pinned and degrades to
  // the inherited value in lockstep, instead of reaching a consumer that trusts
  // every value it sees.
  const pinned = !deepEqual(own, def.defaultValue) && isUsableValue(def, own)
  const inherited = isUsableValue(def, promoted) ? promoted : base
  const value = pinned ? own : inherited
  return { base, pinned, promoted, value }
}

/**
 * Whether this track pins the slot (holds a non-default value) rather than
 * inheriting the session-wide promoted default. Module-internal (exercised by
 * promotableDefaults.test.ts); not part of the public barrel.
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
 * The display's full config snapshot (`getConfSnapshot`) with every `promotable`
 * slot overwritten by its resolved value in place. For building a worker payload:
 * a promotable slot serializes as its raw inherit sentinel — an `'inherit'` enum
 * member, or the `undefined` of a `maybeBoolean`/`maybeNumber` — which the worker
 * can't interpret. This hands it concrete values instead, with no per-slot
 * bookkeeping, so adding a promotable worker-consumed slot needs no rpcProps
 * change and can't silently ship a sentinel. Main-thread only (getConfResolved
 * consults the session). Display-only promotable slots the worker never reads
 * (e.g. displayMode) are still excluded by the caller — resolving them here is a
 * harmless no-op since they're dropped anyway.
 */
export function resolvePromotableConfigSnapshot(
  self: PromotableDisplay,
): Record<string, unknown> {
  const snap = getConfSnapshot(self.configuration)
  for (const slot of promotableSlots(self)) {
    snap[slot] = getConfResolved(self, slot)
  }
  return snap
}

/**
 * true when every listed slot's resolved value already equals its session-wide
 * promoted default. Module-internal — backs `makeCurrentValueSessionDefaultControl`.
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
 * Explicit setter for a group of slots' session-wide default: `promote` stores
 * each slot's current resolved value as the default for this display type;
 * `!promote` clears it so sibling tracks fall back to their own config. The
 * caller decides direction — pass `!areSlotsAtSessionDefault(...)` to toggle at
 * the point of use. Grouping (e.g. featureHeight + featureSpacing) keeps a
 * multi-slot setting behind one "make default" item. Module-internal — backs
 * `makeCurrentValueSessionDefaultControl`.
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
 * Whether a *specific* value is the session-wide promoted default for this slot,
 * independent of the track's current value. Backs the always-visible per-value
 * "make this the default" controls (`makeSessionDefaultControl` /
 * `makeSlotsValueSessionDefaultControl`), whose meaning is "promote this
 * on-value" rather than the value-dependent `areSlotsAtSessionDefault` used by
 * "promote whatever is current" controls. Module-internal.
 */
export function isSlotValueSessionDefault(
  self: PromotableDisplay,
  slot: string,
  value: unknown,
): boolean {
  return deepEqual(resolveSlot(self, slot).promoted, value)
}

/**
 * Promote a specific value as the session-wide default for this slot (`on`), or
 * clear the default (`!on`). Pair with `isSlotValueSessionDefault`.
 * Module-internal — backs the per-value `make*Control` factories.
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

/** one slot value a promotable-default control promotes */
export interface PromotableEntry {
  slot: string
  value: unknown
}

/**
 * #api core/configuration
 * A promotable "default for all tracks of this type" control, bundled so a menu
 * row consumes it as a single prop. `active` = this value is currently the
 * session default; `toggle` sets it as the default or clears it (non-destructive
 * — no open track is overwritten). `self`/`entries` let the trailing adornment
 * open the manage-default dialog, whose "apply to open tracks" is the only path
 * that overwrites tracks pinned to a different value.
 */
export interface SessionDefaultControl {
  active: boolean
  toggle: () => void
  self: PromotableDisplay
  entries: PromotableEntry[]
}

// A view whose open tracks we can enumerate. The generic view interface doesn't
// surface `tracks`, so narrow structurally (mirrors OverrideBadge) — the
// declared display shape is the same PromotableDisplay the cascade already
// operates on.
function hasOpenTracks<T extends object>(
  view: T,
): view is T & { tracks: { displays: PromotableDisplay[] }[] } {
  return 'tracks' in view && Array.isArray(view.tracks)
}

// Every open track showing this display type, across all open views — the full
// set "apply to open tracks" reaches (session-wide, matching the promoted
// default's own reach). Views that don't show tracks (e.g. dotplot) drop out via
// the structural guard. In practice a track has one display (`replaceDisplay`
// swaps in place, `activeDisplay` is `displays[0]`), so the inner flatMap just
// collects each track's display without relying on multiple-per-track.
function openDisplaysOfType(self: PromotableDisplay): PromotableDisplay[] {
  const session = getSession(self)
  const views = isViewContainer(session) ? session.views : []
  return views
    .filter(hasOpenTracks)
    .flatMap(view => view.tracks)
    .flatMap(track => track.displays)
    .filter(display => display.type === self.type)
}

/**
 * Clear each display's own value on `slots` back to the slot default, so it
 * un-pins and inherits the session-wide promoted default instead of baking in a
 * value that wouldn't track a later default change. Displays already at the
 * default are skipped. Takes the display set explicitly so it's unit-testable.
 */
export function clearPinsToInherit(
  displays: PromotableDisplay[],
  slots: string[],
): void {
  for (const display of displays) {
    for (const slot of slots) {
      const def = getSlotDefinition(display.configuration, slot)
      if (!deepEqual(getConf(display, slot), def.defaultValue)) {
        display.configuration.setSlot(slot, def.defaultValue)
      }
    }
  }
}

/**
 * #api core/configuration
 * Whether every value in `entries` is the current session default for its slot.
 * The live state the manage-default dialog's checkbox reflects.
 */
export function isPromotableDefault(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): boolean {
  return entries.every(({ slot, value }) =>
    isSlotValueSessionDefault(self, slot, value),
  )
}

/**
 * #api core/configuration
 * Set (`on`) or clear (`!on`) this value combination as the session default for
 * the display type. Non-destructive: un-pinned open tracks inherit it via
 * `getConfResolved`; tracks pinned to their own value keep it.
 */
export function setPromotableDefault(
  self: PromotableDisplay,
  entries: PromotableEntry[],
  on: boolean,
): void {
  for (const { slot, value } of entries) {
    setSlotValueSessionDefault(self, slot, value, on)
  }
}

/**
 * #api core/configuration
 * Open tracks (across all views) whose resolved value differs from `entries` —
 * exactly the tracks "apply to open tracks" would visibly change. Drives the
 * dialog's preview list and count.
 */
export function tracksDifferingFrom(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): PromotableDisplay[] {
  return openDisplaysOfType(self).filter(display =>
    entries.some(
      ({ slot, value }) => !deepEqual(resolveSlot(display, slot).value, value),
    ),
  )
}

/**
 * #api core/configuration
 * Apply a promotable value along either or both axes — the manage-default
 * dialog's submit. `future` sets (or clears) the session default so new + un-pinned
 * tracks inherit it. `openTracks` also updates the currently-open tracks that
 * differ: when the default now holds these values (`future`), un-pin them so they
 * inherit it (and track later changes); otherwise write the values onto them
 * directly, so "open tracks" works even without a persistent default.
 */
export function applyPromotableDefault(
  self: PromotableDisplay,
  entries: PromotableEntry[],
  opts: { future: boolean; openTracks: boolean },
): void {
  setPromotableDefault(self, entries, opts.future)
  if (opts.openTracks) {
    const differing = tracksDifferingFrom(self, entries)
    if (opts.future) {
      clearPinsToInherit(
        differing,
        entries.map(e => e.slot),
      )
    } else {
      for (const display of differing) {
        for (const { slot, value } of entries) {
          display.configuration.setSlot(slot, value)
        }
      }
    }
  }
}

// Shared control builder: `active` reflects whether this exact value combination
// is the current default; `toggle` flips it (set/clear, non-destructive).
function makePromotableControl(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): SessionDefaultControl {
  const active = isPromotableDefault(self, entries)
  return {
    active,
    self,
    entries,
    toggle: () => {
      setPromotableDefault(self, entries, !active)
    },
  }
}

/**
 * #api core/configuration
 * Per-value control: "make `slot === onValue` the session default". The meaning
 * is per-value ("make arcs the default"), independent of the track's current
 * value — so an always-visible control never promotes a meaningless value, and
 * two toggles sharing one slot (arcs vs read cloud) stay independent.
 */
export function makeSessionDefaultControl(
  self: PromotableDisplay,
  slot: string,
  onValue: unknown,
): SessionDefaultControl {
  return makePromotableControl(self, [{ slot, value: onValue }])
}

/**
 * #api core/configuration
 * Promote-current control: "make this track's current resolved value(s) the
 * session default". Use for a symmetric setting (a `maybeBoolean` toggle, or a
 * multi-mode slot like displayMode) where the pin means "whatever I'm showing",
 * not a fixed on-value. Groups multiple slots behind one control.
 */
export function makeCurrentValueSessionDefaultControl(
  self: PromotableDisplay,
  slots: string[],
): SessionDefaultControl {
  return makePromotableControl(
    self,
    slots.map(slot => ({ slot, value: getConfResolved(self, slot) })),
  )
}

/**
 * #api core/configuration
 * Per-value control over a *group* of slots: "make this exact combination of
 * slot values the session default". Like `makeSessionDefaultControl` but for a
 * multi-slot value (e.g. a feature-height preset = height + spacing + mode), so
 * each row of a preset radio group gets its own independent control whose
 * `active` reflects that specific combination being the current default.
 */
export function makeSlotsValueSessionDefaultControl(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): SessionDefaultControl {
  return makePromotableControl(self, entries)
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
