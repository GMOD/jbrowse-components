import { getType } from '@jbrowse/mobx-state-tree'

import { deepEqual } from '../util/deepEqual.ts'
import { getSession } from '../util/index.ts'
import { getEnumerationValues } from '../util/mst-reflection.ts'
import { getSlotDefinition } from './slotFacade.ts'
import {
  getConfigurationSchemaDefinition,
  isSlotDefinitionEntry,
  readConfObject,
} from './util.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationModel } from './types.ts'
import type { IAnyStateTreeNode, IAnyType } from '@jbrowse/mobx-state-tree'

/**
 * The read-time resolver behind `promotable` config slots — a small CSS cascade
 * for one slot. A `promotable` slot resolves through three tiers:
 *
 *   track's own value (differs from the slot default) -> session-wide default
 *   for this display type -> the slot's base value
 *
 * A display marks a slot `promotable: true` and reads it with `getConf` (which
 * routes any promotable slot through `resolveSlot`); the session store
 * (`get/setDisplayTypeDefault`) holds the promoted value. `stripDefault`
 * collapses an at-default slot, so "at the slot default = follows the default"
 * needs no stored flag. `resolveSlot` is the one place the cascade lives; the
 * control builders in `promotableDefaults.ts` read a field off it.
 *
 * Whether the default value itself can be customized per-track depends on the slot:
 *   - Plain: `defaultValue` is both the base and the inherit signal, so it can't
 *     be customized over an opposite session default. Only safe when no control
 *     ever promotes the *opposite* of `defaultValue`; otherwise the setting
 *     becomes unturn-off-able and the slot wants the sentinel form. Every
 *     production promotable slot uses the sentinel form — prefer it for new slots.
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

// The `promotable` slot names of one config schema (includes slots inherited via
// baseConfiguration — merged into the table at construction), cached by MST type
// since a schema's slot table is fixed. Empty for a non-schema node. This is
// both the resolver's own slot enumeration and the per-schema test `getConf` uses
// to decide whether to route a read through the cascade.
const promotableSlotsByType = new WeakMap<IAnyType, Set<string>>()

export function promotableSlotNames(
  config: AnyConfigurationModel,
): Set<string> {
  const type = getType(config)
  const cached = promotableSlotsByType.get(type)
  if (cached) {
    return cached
  }
  const names = new Set<string>()
  const table = getConfigurationSchemaDefinition(config)
  for (const [name, def] of Object.entries(table ?? {})) {
    if (isSlotDefinitionEntry(def) && def.promotable) {
      names.add(name)
    }
  }
  promotableSlotsByType.set(type, names)
  return names
}

// The names of every promotable slot on a display's config schema.
export function promotableSlots(self: PromotableDisplay): string[] {
  return [...promotableSlotNames(self.configuration)]
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
export function isUsableValue(
  def: ConfigSlotDefinition,
  value: unknown,
): boolean {
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

export interface SlotResolution {
  /** value a track following the default shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** track holds its own value rather than following the default */
  customized: boolean
  /** the raw session-wide promoted default, if any */
  promoted: unknown
  /** the final cascaded value (never a slot's inherit sentinel) */
  value: unknown
}

// The whole three-tier cascade for one slot, in one place. `getConf` routes
// every promotable-slot read here, and the control builders in
// `promotableDefaults.ts` read a field off this.
export function resolveSlot(
  self: PromotableDisplay,
  slot: string,
): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  const base = def.promotedBase ?? def.defaultValue
  // raw read through `readConfObject`: the resolver wants the track's own stored
  // value, before any cascade.
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
