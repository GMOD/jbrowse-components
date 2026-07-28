import { getSession } from '../util/index.ts'
import { getEnumerationValues } from '../util/mst-reflection.ts'
import { getSlotDefinition } from './slotFacade.ts'
import { isCallbackValue } from './slotValueUtils.ts'
import { readConfObject } from './util.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'
import type { AnyConfigurationModel } from './types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * The read-time resolver behind `promotable` config slots — a small CSS cascade
 * for one slot. A `promotable` slot resolves through three tiers:
 *
 *   track's own (set) value -> session-wide default for this display type ->
 *   the slot's base value
 *
 * A display marks a slot `promotable: true` and reads it with `resolveConf` (a
 * thin reader over `resolveSlot`); the session store
 * (`get/setDisplayTypeDefault`) holds the promoted value. `stripDefault`
 * collapses an unset slot out of the snapshot, so "unset = follows the default"
 * needs no stored flag. `resolveSlot` is the one place the cascade lives; the
 * control builders in `promotableDefaults.ts` read a field off it.
 *
 * **The inherit sentinel is always `undefined`.** Every promotable slot is a
 * `maybe*` type (`maybeNumber`/`maybeBoolean`/`maybeColor`/`maybeStringEnum`/
 * `maybeFrozen`), so being unset is CSS `inherit` and `promotedBase` is CSS
 * `initial`; `ConfigSlot` enforces both. That is what frees every *real* value,
 * `promotedBase` included, to be customized per-track under an opposite promoted
 * default — and it keeps the mechanism out of the slot's own vocabulary, so no
 * enumeration carries a fake `'inherit'` member for a menu or the config editor
 * to render.
 *
 * Comparisons against a promoted value use `deepEqual`, not `===`: needed once a
 * promotable slot is object-valued (`maybeFrozen`, e.g. alignments `colorBy`),
 * where a fresh MST-reconstructed value is never `===` the stored one.
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

/**
 * What the slot literally holds, unevaluated — a `jexl:` slot yields the raw
 * `jexl:...` string rather than running it. The distinction matters twice in
 * this subsystem, and both callers need the raw form for the same reason: they
 * ask "is the slot set, and to what kind of thing?", a question that has to be
 * answerable with no feature context (evaluating a callback without one throws).
 * `readConfObject` is the evaluating counterpart, and is what every value read
 * goes through.
 */
export function storedSlotValue(
  self: PromotableDisplay,
  slot: string,
): unknown {
  return self.configuration[slot]
}

/**
 * Whether a stored value could really be a value of this slot — the single
 * gate both cascade tiers pass a candidate through: a session-wide promoted
 * default, and a track's own value read from an untyped saved snapshot. Four
 * independent checks, each obviously correct on its own:
 *   1. it's set at all — `undefined` IS the inherit sentinel on every promotable
 *      slot, which is why they're all `maybe*` types,
 *   2. it isn't a raw `jexl:` string. Nothing in the app can promote one (the
 *      promote-current pin refuses a callback slot, and the resolver's own
 *      callback branch returns before this), but the promoted-default store is
 *      untyped and localStorage-backed, so a hand-edited or corrupted entry
 *      would otherwise sail through `maybeColor`'s bare `typeof === 'string'`
 *      check and be handed to a renderer as a literal color,
 *   3. its JS shape fits the slot (`matchesSlotShape`),
 *   4. it passes the slot's optional semantic `validate` hook.
 * An unusable value is dropped so every consumer falls back in lockstep.
 */
export function isUsableValue(
  def: ConfigSlotDefinition,
  value: unknown,
): boolean {
  const { validate } = def
  return (
    value !== undefined &&
    !isCallbackValue(value) &&
    matchesSlotShape(def, value) &&
    (!validate || validate(value))
  )
}

// Per-slot-type JS shape checks, for the slot types whose value needs more than
// a `typeof` against `promotedBase`. Only the `maybe*` types appear, because
// `ConfigSlot` admits nothing else as promotable and this table is only ever
// consulted for a promotable slot. Any type absent here (`maybeBoolean`,
// `maybeColor`, `maybeFrozen`) falls through to the `promotedBase`-derived check
// in `matchesSlotShape`.
const SHAPE_CHECKS: Record<
  string,
  (value: unknown, def: ConfigSlotDefinition) => boolean
> = {
  // a bare `typeof value === 'number'` would admit `NaN`/`±Infinity`, which no
  // slot legitimately holds
  maybeNumber: value => Number.isFinite(value),
  // a `maybeStringEnum` with no `model` can't be membership-checked; reject
  // rather than admit any string. `def.model` is the author's plain enumeration
  // (ConfigSlot adds the nullability), so this reads the real vocabulary.
  maybeStringEnum: (value, def) =>
    !!def.model &&
    typeof value === 'string' &&
    getEnumerationValues(def.model).includes(value),
}

// Whether `value` has a JS shape this slot could hold. Guards the untyped
// session store / saved snapshot against garbage; not a full validation
// (`validate` layers semantics on top).
//
// Keyed off `promotedBase`, the one concrete specimen of the slot's value space
// a promotable slot declares — its `defaultValue` is always the `undefined`
// inherit sentinel, which would make this demand `typeof value === 'undefined'`
// and reject every real value.
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

interface SlotResolutionTiers {
  /** value a track following the default shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** the raw session-wide promoted default, if any */
  promoted: unknown
}

/**
 * The outcome of walking the cascade for one slot. A **discriminated union on
 * `callback`**, because the two cases genuinely have different things to offer:
 * a fixed value has one settled `value`, while a `jexl:` callback computes a
 * different value per feature and so has none until someone supplies a context.
 *
 * The union is what makes that safe. `value` simply doesn't exist on the
 * callback branch, so a consumer with no `args` to give (the pin, the badge, the
 * worker payload) can't read one by accident — it either branches on `callback`
 * or fails to compile. That used to be a convention: `value` was a lazy getter
 * that evaluated the callback against an empty context, throwing out of whatever
 * menu was being built.
 */
export type SlotResolution =
  | (SlotResolutionTiers & {
      callback: false
      /** track holds its own value rather than following the default */
      customized: boolean
      /** the final cascaded value (never the `undefined` inherit sentinel) */
      value: unknown
    })
  | (SlotResolutionTiers & {
      callback: true
      /** writing a callback *is* customizing the track, so always true */
      customized: true
      /**
       * run the callback with the `args` of this read. Only `resolveConf` calls
       * it — it's the one reader that has the caller's context (a `{ feature }`).
       */
      evaluate: () => unknown
    })

// The whole three-tier cascade for one slot, in one place. `resolveConf` is the
// public reader over it, and the control builders in `promotableDefaults.ts`
// read a field off it.
//
// `args` are the jexl callback arguments of the originating `resolveConf` read (a
// `{ feature }`, say), and feed exactly one thing: the `evaluate()` of a slot
// holding a `jexl:` value, so it sees the same context an ordinary slot read
// would. Every other path is a plain stored value, which is why the cascade's own
// consumers (the pin, the badge) can call with no args at all.
export function resolveSlot(
  self: PromotableDisplay,
  slot: string,
  args: Record<string, unknown> = {},
): SlotResolution {
  const def = getSlotDefinition(self.configuration, slot)
  // A real slot that just isn't `promotable` would otherwise resolve silently
  // wrong here (no `promotedBase`, so every tier collapses to `undefined`) and,
  // through a control builder, write a promoted default nothing ever reads.
  // `getSlotDefinition` already throws on a slot name that doesn't exist at all.
  if (!def.promotable) {
    throw new Error(`config slot "${slot}" is not promotable`)
  }
  // `ConfigSlot` requires `promotedBase` on every promotable slot, so this is the
  // slot's CSS `initial`
  const base = def.promotedBase
  // `promoted` stays the raw session-wide value regardless of this display's
  // opt-out: it's a session-wide fact, and `isPromotableDefault` (the pin's
  // filled/outline state) reports on the session, not on one display's view of
  // it. The opt-out belongs to `inherited` below, which is the only tier of the
  // cascade it may neutralize.
  const promoted = getSession(self).getDisplayTypeDefault?.(self.type, slot)
  // A `jexl:` value leaves the cascade immediately: a callback computes a
  // different value per call (per feature), so it has no single value to weigh
  // against the cascade — writing one *is* customizing the track. Evaluating it
  // needs the caller's `args`, which the cascade's own consumers (the pin, the
  // badge) don't have, so this branch offers `evaluate()` instead of a `value`:
  // they read `customized`/`promoted` and the type stops them evaluating, while a
  // real `resolveConf(self, slot, { feature })` read gets exactly what an
  // ordinary slot read would — including the same error if the context is
  // missing.
  if (isCallbackValue(storedSlotValue(self, slot))) {
    return {
      base,
      customized: true,
      promoted,
      callback: true,
      evaluate: () => readConfObject(self.configuration, slot, args),
    }
  }
  // the track's own value, before any cascade. No `args`: the callback branch
  // above already returned, so nothing left here can consume them.
  const own = readConfObject(self.configuration, slot)
  // A track is customized exactly when it holds a *usable* value — being unset
  // is the inherit sentinel, so "set to something the slot could hold" is the
  // whole test. Routing `own` through the same gate as a promoted default means
  // an own value that's malformed or fails `validate` (e.g. a saved `colorBy`
  // naming a since-removed scheme) reads as not customized and degrades to the
  // inherited value in lockstep, instead of reaching a consumer that trusts
  // every value it sees.
  const customized = isUsableValue(def, own)
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
