import { getType } from '@jbrowse/mobx-state-tree'

import { deepEqual } from '../util/deepEqual.ts'
import { getSession } from '../util/index.ts'
import { getEnumerationValues } from '../util/mst-reflection.ts'
import { getSlotDefinition } from './slotFacade.ts'
import { isCallbackValue } from './slotValueUtils.ts'
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
 * Every promotable slot spends its `defaultValue` on a dedicated **inherit
 * sentinel** (CSS `inherit`) — a spare `'inherit'` enum member, or the
 * `undefined` of a `maybeBoolean`/`maybeNumber`/`maybeColor` — and declares
 * `promotedBase` for what that resolves to (CSS `initial`). `ConfigSlot` enforces
 * both. That is what frees every *real* value, `promotedBase` included, to be
 * customized per-track under an opposite promoted default.
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
// inherit": `undefined` (an unset/stripped slot), or the slot's own
// `defaultValue`, which for a promotable slot IS the inherit sentinel.
function isConcreteValue(def: ConfigSlotDefinition, value: unknown): boolean {
  return value !== undefined && !deepEqual(value, def.defaultValue)
}

// Per-slot-type JS shape checks, for the slot types whose value needs more than
// a `typeof` against `promotedBase`: a *finite* number (a bare `typeof value ===
// 'number'` would admit `NaN`/`±Infinity`, which no slot legitimately holds), or
// membership in an enumeration. Any type absent here falls through to the
// `promotedBase`-derived check in `matchesSlotShape`.
const SHAPE_CHECKS: Record<
  string,
  (value: unknown, def: ConfigSlotDefinition) => boolean
> = {
  integer: value => Number.isFinite(value),
  number: value => Number.isFinite(value),
  maybeNumber: value => Number.isFinite(value),
  // a `stringEnum` with no `model` can't be membership-checked; reject rather
  // than admit any string
  stringEnum: (value, def) =>
    !!def.model &&
    typeof value === 'string' &&
    getEnumerationValues(def.model).includes(value),
}

// Whether `value` has a JS shape this slot could hold. Guards the untyped
// session store / saved snapshot against garbage; not a full validation
// (`validate` layers semantics on top).
//
// Keyed off `promotedBase` rather than `defaultValue` because on a promotable
// slot `defaultValue` is the inherit sentinel, not a specimen of the slot's value
// space — a `maybeBoolean`'s `undefined` default would make this demand `typeof
// value === 'undefined'` and reject every real value.
//
// This can't just delegate to the slot's MST `model.is(value)`: that's too
// permissive exactly where this guard matters — `types.number.is(NaN)` and
// `types.frozen().is('any-string')` are both `true`.
function matchesSlotShape(def: ConfigSlotDefinition, value: unknown): boolean {
  const { promotedBase } = def
  const check = SHAPE_CHECKS[def.type]
  return check
    ? check(value, def)
    : typeof promotedBase === 'object' && promotedBase !== null
      ? // object/array slot (e.g. `colorBy`): match null-ness and array-ness —
        // a bare `typeof` compare would admit `null` (typeof null === 'object')
        // and an array against an object base
        typeof value === 'object' &&
        value !== null &&
        Array.isArray(value) === Array.isArray(promotedBase)
      : typeof value === typeof promotedBase
}

export interface SlotResolution {
  /** value a track following the default shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** track holds its own value rather than following the default */
  customized: boolean
  /** the raw session-wide promoted default, if any */
  promoted: unknown
  /**
   * the track holds a `jexl:` callback, so it has no single value to compare:
   * `customized` is true and `value` is whatever the callback returns for the
   * `args` of this read. A consumer with no `args` (the pin, the badge) must
   * branch on this instead of reading `value`, which evaluates lazily and would
   * throw for a callback needing a context it can't supply.
   */
  callback: boolean
  /** the final cascaded value (never a slot's inherit sentinel) */
  value: unknown
}

// The whole three-tier cascade for one slot, in one place. `getConf` routes
// every promotable-slot read here, and the control builders in
// `promotableDefaults.ts` read a field off this.
//
// `args` are the jexl callback arguments of the originating `getConf` read (a
// `{ feature }`, say), forwarded so a promotable slot holding a `jexl:` value
// evaluates with the same context an ordinary slot read would get. The cascade
// consumers that have no such context (the pin, the badge) call with none — see
// the callback short-circuit below for why that's still sound.
export function resolveSlot(
  self: PromotableDisplay,
  slot: string,
  args: Record<string, unknown> = {},
): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  // `ConfigSlot` requires `promotedBase` on every promotable slot, so this is the
  // slot's CSS `initial` — never the inherit sentinel in `defaultValue`
  const base = def.promotedBase
  // `promoted` stays the raw session-wide value regardless of this display's
  // opt-out: it's a session-wide fact, and `isPromotableDefault` (the pin's
  // filled/outline state) reports on the session, not on one display's view of
  // it. The opt-out belongs to `inherited` below, which is the only tier of the
  // cascade it may neutralize.
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  // A `jexl:` value leaves the cascade immediately: a callback computes a
  // different value per call (per feature), so it can't be compared against the
  // slot default to decide "follows the default" — writing one *is* customizing
  // the track. Reading it needs the caller's `args`, which the cascade's own
  // consumers (the pin, the badge) don't have, so `value` evaluates lazily: they
  // read `customized`/`promoted` without ever evaluating, while a real
  // `getConf(self, slot, { feature })` read gets exactly what an ordinary slot
  // read would — including the same error if the context is missing.
  if (isCallbackValue(self.configuration[slot])) {
    return {
      base,
      customized: true,
      promoted,
      callback: true,
      get value() {
        return readConfObject(self.configuration, slot, args)
      },
    }
  }
  // raw read through `readConfObject`: the resolver wants the track's own stored
  // value, before any cascade.
  const own = readConfObject(self.configuration, slot, args)
  // A track is customized only when it holds a *usable* value other than the
  // default. Routing `own` through the same `isUsableValue` gate as a promoted
  // default means an own value that's malformed or fails `validate` (e.g. a saved
  // `colorBy` naming a since-removed scheme) reads as not customized and degrades
  // to the inherited value in lockstep, instead of reaching a consumer that
  // trusts every value it sees.
  const customized =
    !deepEqual(own, def.defaultValue) && isUsableValue(def, own)
  // A display that arrived in a received session skips the session-wide tier
  // entirely, collapsing the cascade to "own value, else base". Needed because
  // baking the resolved values into the shared snapshot can't cover the case
  // where the sender saw the *base* value: nothing gets baked (it equals base),
  // so without the opt-out the recipient's own promoted default would repaint it.
  const inherited =
    !self.ignorePromotedDefaults && isUsableValue(def, promoted)
      ? promoted
      : base
  const value = customized ? own : inherited
  return { base, customized, promoted, callback: false, value }
}
