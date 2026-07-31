/**
 * @module
 * The read-time resolver behind `promotable` config slots — a small CSS cascade
 * for one slot: the track's own set value -> the session-wide default for its
 * display type -> the slot's `promotedBase`. `resolveSlotIn` is the whole of it;
 * `resolveConf` and the control builders in `promotableDefaults.ts` each read a
 * field off the `SlotResolution` it returns.
 *
 * Mechanism: `agent-docs/reference/DISPLAY_TYPE_DEFAULTS.md`. Two decisions the
 * inline comments below defend: resolution is named at its call sites rather than
 * folded into `getConf` (ADR-046), and unset is the only inherit sentinel
 * (ADR-047) — every promotable slot is a `maybe*` type, so `undefined` is CSS
 * `inherit` and `promotedBase` is CSS `initial`, both enforced by `ConfigSlot`.
 *
 * Every comparison against a promoted or base value is `deepEqual`, never `===`:
 * an object-valued slot (`maybeFrozen`, e.g. alignments `colorBy`) reconstructs a
 * fresh value out of MST that is never `===` its stored twin, so `===` would read
 * it as permanently differing and no pin would ever light up.
 *
 * The gate a candidate value passes to count at all is `isUsableValue`, in
 * `slotShape.ts` — shared with `ConfigSlot`, which applies it to `promotedBase`
 * at construction so the tier this file falls back to is usable by construction.
 */
import { deepEqual } from '../util/deepEqual.ts'
import { getSession } from '../util/index.ts'
import { getSlotDefinition } from './slotFacade.ts'
import { isUsableValue } from './slotShape.ts'

import type { AnyConfigurationModel } from './types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

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
 * Where the session-wide tier of the cascade is read from. Narrowed to the one
 * method so the resolver doesn't depend on the whole session type.
 */
export interface PromotedDefaultStore {
  getDisplayTypeDefault: (displayType: string, slot: string) => unknown
}

/**
 * The cascade's inputs, stated directly rather than read off a display state
 * node. `ResolvableDisplay` is the usual way to supply them (see
 * `cascadeContextFor`), but a display config can also be resolved with **no
 * state node at all** — a track that isn't open has none, and "Copy config" in
 * the About dialog still has to show what it would render as. That path passes
 * the display's config plus the session directly.
 */
export interface CascadeContext {
  config: AnyConfigurationModel
  displayType: string
  ignorePromotedDefaults: boolean
  defaults: PromotedDefaultStore
}

export function cascadeContextFor(self: ResolvableDisplay): CascadeContext {
  return {
    config: self.configuration,
    displayType: self.type,
    ignorePromotedDefaults: self.ignorePromotedDefaults,
    defaults: getSession(self),
  }
}

/**
 * What the slot literally holds, unevaluated — a stray `jexl:` string yields the
 * raw string rather than running it. Both callers ask "is the slot set, and to
 * what kind of thing?", which has to be answerable with no feature context.
 *
 * Deliberately not `readConfObject`: for a promotable slot this is the whole
 * stored read, and both of that reader's extra behaviors are unwanted here — it
 * evaluates a `jexl:` string (which `isUsableValue` refuses anyway) and it
 * snapshots an MST-node value, which a `maybe*` slot never holds.
 */
export function storedSlotValue(
  config: AnyConfigurationModel,
  slot: string,
): unknown {
  return config[slot]
}

/**
 * The outcome of walking the cascade for one slot: the two tiers that fed it,
 * whether the track customized it, and the settled value.
 *
 * There is deliberately **no callback case** — a `jexl:` value fails
 * `isUsableValue` like any other unusable value and degrades to the inherited
 * one, so `value` is always readable. See `isUsableValue`.
 */
export interface SlotResolution {
  /** value a track following the default shows with nothing promoted (CSS `initial`) */
  base: unknown
  /** the raw session-wide promoted default, if any */
  promoted: unknown
  /** track holds its own value rather than following the default */
  customized: boolean
  /**
   * the value came from the session-wide tier — the track follows the default
   * *and* that default moves it off `base`. The "this display picked something
   * up from the session" predicate, for the badge diff and the About dialog's
   * copy-config note. A field rather than a `!customized && !deepEqual(value,
   * base)` at each call site, because getting either half wrong is silent:
   * dropping `customized` reports a customized track as inheriting, dropping
   * the `base` compare flags a promoted default that changes nothing.
   */
  inherited: boolean
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
  return resolveSlotIn(cascadeContextFor(self), slot)
}

// The cascade over explicit inputs. `resolveSlot` is the display-state spelling
// of this and the one nearly every consumer wants; the direct form exists for
// the config-only path (a track that isn't open has no display state — see
// `CascadeContext`).
export function resolveSlotIn(
  ctx: CascadeContext,
  slot: string,
): SlotResolution {
  const def = getSlotDefinition(ctx.config, slot)
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
  // stays the raw session-wide value regardless of this display's opt-out: it's
  // a session-wide fact, and `isPromotableDefault` (the pin's filled/outline
  // state) reports on the session, not on one display's view of it. The opt-out
  // may neutralize only `inheritedValue` below.
  const promoted = ctx.defaults.getDisplayTypeDefault(ctx.displayType, slot)
  const own = storedSlotValue(ctx.config, slot)
  // A track is customized exactly when it holds a *usable* value — being unset
  // is the inherit sentinel, so "set to something the slot could hold" is the
  // whole test. Routing `own` through the same gate as a promoted default is
  // what makes a malformed or stale own value (a saved `colorBy` naming a
  // since-removed scheme) read as not-customized and degrade in lockstep,
  // instead of reaching a consumer that trusts every value it sees.
  const customized = isUsableValue(def, own)
  // A display that arrived in a received session skips the session-wide tier
  // entirely, collapsing the cascade to "own value, else base". Baking the
  // sender's resolved values into the shared snapshot can't replace this: where
  // the sender saw the *base* value nothing gets baked, so without the opt-out
  // the recipient's own promoted default would repaint it.
  const inheritedValue =
    !ctx.ignorePromotedDefaults && isUsableValue(def, promoted)
      ? promoted
      : base
  const value = customized ? own : inheritedValue
  return {
    base,
    customized,
    promoted,
    inherited: !customized && !deepEqual(value, base),
    value,
  }
}
