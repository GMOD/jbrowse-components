import { getSession } from '../util/index.ts'
import { getEnumerationValues } from '../util/mst-reflection.ts'
import { getSlotDefinition } from './slotFacade.ts'
import { isCallbackValue } from './slotValueUtils.ts'

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
/**
 * Everything the cascade needs to **read** a promotable slot: the display type
 * it keys the session-wide default on, the config holding the track's own value,
 * and the received-session opt-out.
 *
 * Deliberately excludes the setter. The subsystem performs exactly one write to
 * a display (`resetSlotToInherit` lifting the opt-out), so every read entry
 * point — `resolveConf`, the control builders, the worker snapshot, the badge
 * diff — asks for this narrower shape instead. That is what lets those take a
 * display state node directly rather than through a cast: a mixin or a test
 * double no longer has to fake a member it never uses.
 */
export type ResolvableDisplay = IAnyStateTreeNode & {
  type: string
  configuration: AnyConfigurationModel
  /**
   * set on a display that arrived in a session received from someone else, to
   * opt it out of the session-wide tier of the cascade. Declared by
   * BaseDisplay, which every real display composes.
   */
  ignorePromotedDefaults: boolean
}

/**
 * A `ResolvableDisplay` the subsystem may also write to. Required only where a
 * display is *collected* to be reset — `openPromotableDisplays` and everything
 * downstream of it — because `resetSlotToInherit` clears the opt-out when the
 * user deliberately opts a received display back into the cascade.
 */
export type PromotableDisplay = ResolvableDisplay & {
  setIgnorePromotedDefaults: (flag: boolean) => void
}

/**
 * What the slot literally holds, unevaluated — a stray `jexl:` string yields the
 * raw string rather than running it. Both callers need the raw form for the same
 * reason: they ask "is the slot set, and to what kind of thing?", a question that
 * has to be answerable with no feature context.
 *
 * For a promotable slot this is also the *whole* stored read, not a cheaper
 * approximation of one. `readConfObject`'s two extra behaviors are both
 * unwanted here: it evaluates a `jexl:` string (which `isUsableValue` rejects
 * outright — see below), and it snapshots a value that is an MST node, which a
 * promotable value never is, since `ConfigSlot` admits only `maybe*` types and
 * those hold a primitive or a `types.frozen` plain object.
 */
export function storedSlotValue(
  self: ResolvableDisplay,
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
 *   2. it isn't a raw `jexl:` string. This is the *only* place a promotable slot
 *      handles callbacks, and it handles them by refusing them: a promoted
 *      default is one value shared by every track of a type, which is the
 *      opposite of a per-feature expression. Nothing in the app can author one
 *      (the config editor's callback toggle needs `contextVariable`, which no
 *      promotable slot declares), but both a saved track config and the
 *      localStorage-backed default store are untyped, so a hand-edited entry
 *      would otherwise sail through `maybeColor`'s bare `typeof === 'string'`
 *      check and be handed to a renderer as a literal color,
 *   3. its JS shape fits the slot (`matchesSlotShape`),
 *   4. it passes the slot's optional semantic `validate` hook.
 * An unusable value is dropped so every consumer falls back in lockstep.
 */
function isUsableValue(def: ConfigSlotDefinition, value: unknown): boolean {
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

/**
 * The outcome of walking the cascade for one slot: the two tiers that fed it,
 * whether the track customized it, and the settled value.
 *
 * There is deliberately **no callback case**. A promotable slot cannot hold a
 * `jexl:` value through any supported path — the config editor only offers the
 * callback toggle on a slot that declares `contextVariable`, and no promotable
 * slot does (a promoted default is one value shared by every track of a type,
 * which is the opposite of a per-feature expression). A hand-edited config that
 * puts one there fails `isUsableValue` like any other unusable value and
 * degrades to the inherited value, so every consumer falls back in lockstep and
 * `value` is always readable.
 */
export interface SlotResolution {
  /** value a track following the default shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** the raw session-wide promoted default, if any */
  promoted: unknown
  /** track holds its own value rather than following the default */
  customized: boolean
  /** the final cascaded value (never the `undefined` inherit sentinel) */
  value: unknown
}

// The whole three-tier cascade for one slot, in one place. `resolveConf` is the
// public reader over it, and the control builders in `promotableDefaults.ts`
// read a field off it.
export function resolveSlot(
  self: ResolvableDisplay,
  slot: string,
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
  const promoted = getSession(self).getDisplayTypeDefault(self.type, slot)
  // The track's own value, before any cascade — the raw stored read, not
  // `readConfObject`, since this *is* the resolver (see `storedSlotValue`).
  const own = storedSlotValue(self, slot)
  // A track is customized exactly when it holds a *usable* value — being unset
  // is the inherit sentinel, so "set to something the slot could hold" is the
  // whole test. Routing `own` through the same gate as a promoted default means
  // an own value that's malformed, a stray `jexl:` string, or one that fails
  // `validate` (e.g. a saved `colorBy` naming a since-removed scheme) reads as
  // not customized and degrades to the inherited value in lockstep, instead of
  // reaching a consumer that trusts every value it sees.
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
  return { base, customized, promoted, value: customized ? own : inherited }
}
