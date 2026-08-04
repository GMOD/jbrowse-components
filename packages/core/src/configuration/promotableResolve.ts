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
import { getSession } from '../util/mstUtils.ts'
import { getSlotDefinition } from './slotFacade.ts'
import { isUsableValue } from './slotShape.ts'

import type { AnyConfigurationModel } from './types.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

/**
 * Everything the cascade needs to read a promotable slot: the display type it
 * keys the session-wide default on, and the config holding the track's own
 * value. Every entry point takes this — `resolveConf`, the control builders,
 * the worker snapshot, the badge diff — so each can take a display state node
 * directly rather than through a cast.
 *
 * Read-only, and there is no write-capable variant. A `PromotableDisplay` used
 * to exist for the one member the subsystem wrote (`setIgnorePromotedDefaults`,
 * the received-session opt-out); with that flag gone the subsystem writes
 * nothing to a display but a config slot, which `setConf` reaches through
 * `configuration`.
 */
export type ResolvableDisplay = IStateTreeNode & {
  type: string
  configuration: AnyConfigurationModel
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
 * `cascadeContextFor`), but nothing here *needs* a state node: the About
 * dialog's "Copy config" resolves a track's display configs directly, which is
 * what lets it answer "what would this render as" for a track that was never
 * opened. Reaching for the open display instead buys nothing — its
 * `configuration` is the same node, and its `type` is that config's own.
 */
export interface CascadeContext {
  config: AnyConfigurationModel
  displayType: string
  defaults: PromotedDefaultStore
}

export function cascadeContextFor(self: ResolvableDisplay): CascadeContext {
  return {
    config: self.configuration,
    displayType: self.type,
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
  // a session-wide fact, and `isPromotableDefault` (the pin's filled/outline
  // state) reports on the session, not on one display's view of it
  const promoted = ctx.defaults.getDisplayTypeDefault(ctx.displayType, slot)
  const own = storedSlotValue(ctx.config, slot)
  // A track is customized exactly when it holds a *usable* value — being unset
  // is the inherit sentinel, so "set to something the slot could hold" is the
  // whole test. Routing `own` through the same gate as a promoted default is
  // what makes a malformed or stale own value (a saved `colorBy` naming a
  // since-removed scheme) read as not-customized and degrade in lockstep,
  // instead of reaching a consumer that trusts every value it sees.
  const customized = isUsableValue(def, own)
  const inheritedValue = isUsableValue(def, promoted) ? promoted : base
  // A customized value wins unconditionally, which is what makes the share bake
  // sufficient on its own: a baked value lands in the track's config, so the
  // recipient reads it as customized and their own promoted default never gets
  // consulted. The one case a bake cannot cover is the sender sitting at `base`
  // while the recipient has promoted something — nothing is baked (the value
  // *is* base, and `stripDefault` drops it from the snapshot), so the recipient
  // resolves it from their own cascade. That is accepted: a promoted default is
  // personal and local, exactly like the theme a session is viewed in, and the
  // alternative was a per-display `ignorePromotedDefaults` flag that also
  // detached received tracks from the recipient's own pins for good.
  const value = customized ? own : inheritedValue
  return {
    base,
    customized,
    promoted,
    inherited: !customized && !deepEqual(value, base),
    value,
  }
}
