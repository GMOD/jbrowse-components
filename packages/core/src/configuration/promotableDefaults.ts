import { getSlotDefinition } from './slotFacade.ts'
import {
  getConfSnapshot,
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
  readConfObject,
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
 *   track's own value (differs from the slot default) -> session-wide default
 *   for this display type -> the slot's base value
 *
 * A display marks a slot `promotable: true`, reads it with `getConfResolved`,
 * and the session store (`get/setDisplayTypeDefault`) holds the promoted value.
 * `stripDefault` collapses an at-default slot, so "at the slot default = follows
 * the default" needs no stored flag. `resolveSlot` is the one place the cascade
 * lives; every exported function reads a field off it.
 *
 * Whether the default value itself can be customized per-track depends on the slot:
 *   - Plain (no current users): `defaultValue` is both the base and the inherit
 *     signal, so it can't be customized over an opposite session default. Only
 *     safe when no control ever promotes the *opposite* of `defaultValue`;
 *     otherwise the setting becomes unturn-off-able and the slot wants the
 *     sentinel form. Every production promotable slot uses the sentinel form —
 *     prefer it for new slots.
 *   - Sentinel (`displayMode`, `showSoftClipping`): `defaultValue` is a dedicated
 *     `'inherit'` member (CSS `inherit`) — or the `undefined` of a
 *     `maybeBoolean`/`maybeNumber` — and `promotedBase` is what it resolves to
 *     (CSS `initial`), freeing every real value — base included — to be
 *     customized. Prefer this for anything a user can toggle both ways.
 *
 * Every comparison below (customized / at-default / at-promoted-default) uses
 * `deepEqual`, not `===`: needed once a promotable slot is `frozen`
 * (object-valued, e.g. alignments `colorBy`), where a fresh MST-reconstructed
 * value is never `===` the stored default.
 */

export type PromotableDisplay = IAnyStateTreeNode & {
  type: string
  configuration: AnyConfigurationModel
  /**
   * set on a display that arrived in a session received from someone else, to
   * opt it out of the session-wide tier of the cascade. Declared by
   * BaseDisplay, which every real display composes.
   */
  ignorePromotedDefaults: boolean
  setIgnorePromotedDefaults: (flag: boolean) => void
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
//
// This can't just delegate to the slot's MST `model.is(value)`: that's too
// permissive exactly where this guard matters — `types.number.is(NaN)` and
// `types.frozen().is('any-string')` are both `true`, so it wouldn't reject the
// non-finite number or the wrong-shape frozen value the branches below catch.
// Only the `stringEnum` membership check has an MST equivalent, and that branch
// is already clear.
function matchesSlotShape(def: ConfigSlotDefinition, value: unknown): boolean {
  const { type, model, defaultValue } = def
  return type === 'stringEnum'
    ? // a `stringEnum` with no `model` can't be membership-checked; reject
      // rather than fall through to the primitive branch, which would admit
      // any string
      !!model &&
        typeof value === 'string' &&
        getEnumerationValues(model).includes(value)
    : // numeric slots must be a *finite* number: `typeof value === 'number'`
      // (or the primitive fallback below) would admit `NaN`/`±Infinity`, which
      // no slot legitimately holds. `maybeNumber` is grouped here — its
      // `undefined` default can't key the shape (`typeof value === typeof
      // undefined` rejects every real value), so it's matched on `type`.
      type === 'maybeNumber' || type === 'number' || type === 'integer'
      ? Number.isFinite(value)
      : // `maybeBoolean` likewise keys on `type`: its `undefined` default can't
        // key the shape
        type === 'maybeBoolean'
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
  /** value a track following the default shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** track holds its own value rather than following the default */
  customized: boolean
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
  // raw read through `readConfObject` (not `getConf`) on purpose: this *is* the
  // resolver, so it wants the track's own stored value; `getConf` would warn
  // about reading a promotable slot raw.
  const own = readConfObject(self.configuration, slot)
  // `promoted` stays the raw session-wide value regardless of this display's
  // opt-out: it's a session-wide fact, and `isPromotableDefault` (the pin's
  // filled/outline state) reports on the session, not on one display's view of
  // it. The opt-out belongs to `inherited` below, which is the only tier of the
  // cascade it may neutralize.
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  // A track is customized only when it holds a *usable* value other than the
  // default. Routing `own` through the same `isUsableValue` gate as a promoted
  // default means an own value that's malformed or fails `validate` (e.g. a saved
  // `colorBy` naming a since-removed scheme) reads as not customized and degrades
  // to the inherited value in lockstep, instead of reaching a consumer that
  // trusts every value it sees.
  const customized =
    !deepEqual(own, def.defaultValue) && isUsableValue(def, own)
  // A display that arrived in a received session skips the session-wide tier
  // entirely, collapsing the cascade to "own value, else base". This is the
  // only mechanism that can neutralize a promoted default on a *plain*
  // promotable slot (one with no `promotedBase`, where `defaultValue` is both
  // the base and the inherit signal): there, no baked-in value can read as
  // customized, so an explicit opt-out is the sole way the sender's `false`
  // survives the recipient's promoted `true`.
  const inherited =
    !self.ignorePromotedDefaults && isUsableValue(def, promoted)
      ? promoted
      : base
  const value = customized ? own : inherited
  return { base, customized, promoted, value }
}

/**
 * #api core/configuration
 * Whether this track has customized the slot (holds a non-default value of its
 * own) rather than following the display type's default. The correct "reset to
 * default" predicate for a promotable slot: comparing the resolved value to the
 * base instead reads as at-default for a track merely *following* a non-base
 * promoted default, so the reset control lights up on a no-op.
 */
export function isSlotCustomized(
  self: PromotableDisplay,
  slot: string,
): boolean {
  return resolveSlot(self, slot).customized
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

/** one slot value a promotable-default control promotes */
export interface PromotableEntry {
  slot: string
  value: unknown
}

/**
 * #api core/configuration
 * A promotable "default for all tracks of this type" control, bundled so a menu
 * row's trailing pin consumes it as a single prop. `active` = this value is
 * currently the session default (a filled pin); `toggle` sets it as the default
 * or clears it. On set, `toggle` immediately applies the value to the display
 * the pin was clicked from (so the active track updates with one click) and
 * raises a snackbar with an "Apply to N open tracks" action for the remaining
 * open tracks not already showing this value (see `applyDefaultToggle`).
 */
export interface DisplayTypeDefaultControl {
  active: boolean
  toggle: () => void
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
 * Reset each display's own value on `slots` back to the slot default, so it
 * follows the display type's default instead of baking in a value that wouldn't
 * track a later default change. Backs the snackbar's "apply to open tracks"
 * action. Displays already at the default are skipped. Takes the display set
 * explicitly so it's unit-testable.
 *
 * Also lifts `ignorePromotedDefaults` on a display that arrived in a received
 * session: every caller reaches here from a deliberate "use this default"
 * click, and that opt-out only exists to stop defaults applying *silently*.
 * Without this the reset would strand such a display on its base value —
 * cleared of its own value, yet still refusing the default it was just told to
 * follow.
 */
export function resetSlotsToInherit(
  displays: PromotableDisplay[],
  slots: string[],
): void {
  for (const display of displays) {
    display.setIgnorePromotedDefaults(false)
    for (const slot of slots) {
      const def = getSlotDefinition(display.configuration, slot)
      // raw read (see resolveSlot): comparing the track's own stored value to
      // the default to decide whether it needs resetting.
      if (
        !deepEqual(
          readConfObject(display.configuration, slot),
          def.defaultValue,
        )
      ) {
        display.configuration.setSlot(slot, def.defaultValue)
      }
    }
  }
}

/**
 * Whether every value in `entries` is the current session default for its slot.
 * The live state the pin's filled/outline reflects — a session-wide fact, so it
 * reads the raw promoted default and ignores this display's
 * `ignorePromotedDefaults` opt-out (which only governs what the display
 * *follows*). Module-internal (exercised by promotableDefaults.test.ts); not
 * part of the public barrel.
 */
export function isPromotableDefault(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): boolean {
  return entries.every(({ slot, value }) =>
    deepEqual(resolveSlot(self, slot).promoted, value),
  )
}

/**
 * Set (`on`) or clear (`!on`) this value combination as the session default for
 * the display type. Non-destructive: tracks that follow the default inherit it
 * via `getConfResolved`; tracks the user has customized keep their own value.
 * Module-private — reached only through `applyDefaultToggle` below (which the
 * control builders drive); plugins promote a value through those builders.
 */
function setPromotableDefault(
  self: PromotableDisplay,
  entries: PromotableEntry[],
  on: boolean,
): void {
  const session = getSession(self)
  for (const { slot, value } of entries) {
    session.setDisplayTypeDefault?.(self.type, slot, on ? value : undefined)
  }
}

/**
 * Open tracks (across all views) whose resolved value differs from `entries` —
 * the ones "apply to open tracks" would visibly change by resetting them to
 * follow the default. Drives that action's count. Module-internal (exercised by
 * promotableDefaults.test.ts); not part of the public barrel.
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
 * Set (or clear) a value combination as the display type's default. Tracks that
 * follow the default pick it up immediately via `getConfResolved`; tracks with
 * their own value keep it. When setting, the display the pin was clicked from is
 * reset to inherit right away so it shows the new default at once, and if any
 * *other* open track isn't already showing this value, the snackbar offers an
 * "Apply to N open tracks" action that makes them follow the new default too.
 * Clearing just notifies.
 */
function applyDefaultToggle(
  self: PromotableDisplay,
  entries: PromotableEntry[],
  on: boolean,
): void {
  const session = getSession(self)
  const slots = entries.map(e => e.slot)
  setPromotableDefault(self, entries, on)
  if (on) {
    // Apply to the track the pin was clicked from right away, so the active
    // display reflects the new default with a single click (resetting it to
    // inherit, the same non-destructive move the snackbar runs on the rest).
    // This also drops it out of `tracksDifferingFrom` below, so the snackbar
    // only counts the *other* open tracks still to convert.
    resetSlotsToInherit([self], slots)
    // open tracks not already showing this value — those the "apply to open
    // tracks" action would visibly change by making them follow the new default
    const tracks = tracksDifferingFrom(self, entries)
    const n = tracks.length
    if (n) {
      session.notify('Set as the default', 'info', {
        name: `Apply to ${n} open track${n === 1 ? '' : 's'}`,
        onClick: () => {
          resetSlotsToInherit(tracks, slots)
        },
      })
    } else {
      session.notify('Set as the default', 'info')
    }
  } else {
    session.notify('Cleared the default', 'info')
  }
}

/**
 * #api core/configuration
 * Per-value control over a *group* of slots: "make this exact combination of
 * slot values the session default". `active` reflects whether this exact
 * combination is the current default; `toggle` flips it (set/clear,
 * non-destructive). Each row of a preset radio group (e.g. a feature-height
 * preset = height + spacing + mode) gets its own independent control. The base
 * builder the single-value / promote-current wrappers below delegate to.
 */
export function makeSlotsValueDisplayTypeDefaultControl(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): DisplayTypeDefaultControl {
  const active = isPromotableDefault(self, entries)
  return {
    active,
    toggle: () => {
      applyDefaultToggle(self, entries, !active)
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
export function makeDisplayTypeDefaultControl(
  self: PromotableDisplay,
  slot: string,
  onValue: unknown,
): DisplayTypeDefaultControl {
  return makeSlotsValueDisplayTypeDefaultControl(self, [
    { slot, value: onValue },
  ])
}

/**
 * #api core/configuration
 * Promote-current control: "make this track's current resolved value(s) the
 * session default". Use for a symmetric setting (a `maybeBoolean` toggle, or a
 * multi-mode slot like displayMode) where the pin means "whatever I'm showing",
 * not a fixed on-value. Groups multiple slots behind one control.
 */
export function makeCurrentValueDisplayTypeDefaultControl(
  self: PromotableDisplay,
  slots: string[],
): DisplayTypeDefaultControl {
  return makeSlotsValueDisplayTypeDefaultControl(
    self,
    slots.map(slot => ({ slot, value: getConfResolved(self, slot) })),
  )
}

/**
 * #api core/configuration
 * Effective differences a track following the default inherits from session-wide
 * defaults, one per promotable slot whose inherited value differs from its schema
 * default. Drives the track-selector "affected by a session default" badge.
 */
export function getDisplayTypeDefaultChanges(
  self: PromotableDisplay,
): TrackConfigChange[] {
  return promotableSlots(self).flatMap(slot => {
    const { base, customized, value } = resolveSlot(self, slot)
    return !customized && !deepEqual(value, base)
      ? [{ path: [slot], from: base, to: value } as TrackConfigChange]
      : []
  })
}

/**
 * #api core/configuration
 * Clear every promoted default for this display type, so sibling tracks revert
 * to their own config values. Backs the badge's "clear default" action.
 */
export function clearPromotedDefaults(self: PromotableDisplay): void {
  const session = getSession(self)
  for (const slot of promotableSlots(self)) {
    session.setDisplayTypeDefault?.(self.type, slot, undefined)
  }
}
