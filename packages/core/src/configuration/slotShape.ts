/**
 * @module
 * The one gate a candidate value for a `promotable` slot has to pass. Shared,
 * deliberately, by the two places that ask the question:
 *
 *  - `promotableResolve.ts` at read time, for both cascade tiers — a session-wide
 *    promoted default and a track's own value out of an untyped saved snapshot;
 *  - `configurationSlot.ts` at construction, for the slot's own `promotedBase`.
 *
 * One implementation is what makes "the base is always a usable value" true by
 * construction rather than assumed: the resolver falls back to `promotedBase`
 * whenever a tier fails this gate, so a base that would itself fail has nowhere
 * left to fall.
 */
import { getEnumerationValues } from '../util/mst-reflection.ts'
import { isCallbackValue } from './slotValueUtils.ts'

import type { ConfigSlotDefinition } from './configurationSlot.ts'

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

/**
 * Whether `value` has a JS shape this slot could hold. Guards the untyped
 * session store / saved snapshot against garbage; not a full validation
 * (`validate` layers semantics on top).
 *
 * Module-private on purpose: `isUsableValue` is the gate, and this is only one
 * of its four checks. A caller reaching for the shape test alone would skip the
 * `jexl:` refusal and the slot's `validate` hook — the two checks that exist
 * precisely because a shape-valid value can still be unusable.
 *
 * Keyed off `promotedBase` because that is the only concrete specimen of the
 * slot's value space a promotable slot declares — `defaultValue` is always the
 * inherit sentinel, so keying off it would demand `typeof value === 'undefined'`.
 * A `promotedBase` checked against itself therefore only exercises the
 * `SHAPE_CHECKS` entries, which is exactly the half that can be authored wrong
 * (an enum member that isn't in the vocabulary, a non-finite number).
 *
 * Can't delegate to the slot's MST `model.is(value)`: too permissive exactly
 * where this guard matters — `types.number.is(NaN)` and
 * `types.frozen().is('any-string')` are both `true`.
 */
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
 * Whether a stored value could really be a value of this slot. An unusable value
 * is dropped by the cascade, so the getter, the pin and the badge all fall back
 * in lockstep.
 *
 * The `jexl:` check is the only place the subsystem handles a callback, and it
 * handles it by refusing it. Nothing in the app can author one, but a
 * hand-edited config or default store is untyped, and a `jexl:` string would
 * otherwise sail through `maybeColor`'s bare `typeof === 'string'` and reach a
 * renderer as a literal color. DISPLAY_TYPE_DEFAULTS.md §"No callbacks".
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
