/**
 * @module
 * Session-wide "promoted defaults" for display-type config slots — the UI /
 * control layer over the read-time cascade in `promotableResolve.ts`, whose
 * `SlotResolution` every function here reads a field off. The session store
 * (`get/setDisplayTypeDefault`) holds the promoted value.
 */
import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'

import { deepEqual } from '../util/deepEqual.ts'
import { getSession } from '../util/mstUtils.ts'
import { isObject } from '../util/objectUtils.ts'
import { openPromotableDisplays } from '../util/openDisplays.ts'
import { pluralize } from '../util/stringUtils.ts'
import { fullConfSnapshot } from './fullConfSnapshot.ts'
import { setConf } from './getConf.ts'
import {
  cascadeContextFor,
  isPromotableValue,
  resolveSlot,
  resolveSlotIn,
  storedSlotValue,
} from './promotableResolve.ts'
import { promotableSlotNames } from './promotableSlots.ts'
import { isConfigurationModel } from './schemaTypes.ts'

import type { TrackConfigChange } from '../util/trackConfigDelta.ts'
import type { SnackAction } from '../util/types/index.ts'
import type { Pin } from './promotablePin.ts'
import type {
  CascadeContext,
  PromotedDefaultStore,
  ResolvableDisplay,
} from './promotableResolve.ts'
import type {
  AnyConfigurationModel,
  ConfigurationSchemaForModel,
  ConfigurationSlotName,
  ConfigurationSlotValueResolved,
} from './types.ts'

export type { Pin } from './promotablePin.ts'

/**
 * #api core/configuration
 * Whether this track has customized the slot (holds a non-default value of its
 * own) rather than following the display type's default. The correct "reset to
 * default" predicate for a promotable slot: comparing the resolved value to the
 * base instead reads as at-default for a track merely *following* a non-base
 * promoted default, so the reset control lights up on a no-op.
 *
 * `SLOT` is constrained the way `getConf`'s is. A pin or a reset over a slot
 * name the schema does not declare is inert and silent — `resolveSlot` answers
 * about nothing, so the control draws outline forever — and a widened `self`
 * switches the check off (`HostChecksSlotNames`).
 */
export function isSlotCustomized<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(self: ResolvableDisplay<CONFMODEL>, slot: SLOT): boolean {
  return resolveSlot(self, slot).customized
}

declare const promotablesResolved: unique symbol

/**
 * #api core/configuration
 * A display config snapshot whose promotable slots hold RESOLVED values rather
 * than the inherit sentinel — what a worker payload has to be built from.
 *
 * The brand is required and unforgeable, so a plain `Record<string, unknown>`
 * is not assignable to it and neither is `getSnapshot(self.configuration)`.
 * That is the whole point. Everything downstream of the resolve is an ERASED
 * container — a snapshot is `Record<string, unknown>`, and the payload it
 * becomes is an `as`-asserted interface — so a payload builder handed the RAW
 * snapshot instead typechecks, ships `undefined` for every promotable slot, and
 * types it as the resolved value. That was measured, not supposed: the raw
 * spelling in `LinearBasicDisplay`'s `rpcProps()` passed `pnpm typecheck` and
 * every suite in `plugins/canvas`, `packages/core/src/configuration` and
 * `products/jbrowse-web`, while sending the worker `undefined` for chevrons,
 * subfeature labels and feature height.
 *
 * The rest of this subsystem's guarantees are carried by types that stay
 * connected to the schema: a raw read of a promotable `maybe*` slot is
 * `T | undefined` (see `ConfigurationSlotValue`), so `getConf` where
 * `resolveConf` was meant is a compile error at any typed consumer. The brand is
 * that guarantee re-established at the point where the connection is cut.
 */
export interface ResolvedConfigSnapshot extends Record<string, unknown> {
  readonly [promotablesResolved]: true
}

/**
 * #api core/configuration
 * The display's full config snapshot with every `promotable`
 * slot overwritten by its resolved value in place. For building a worker payload:
 * a promotable slot serializes as its raw inherit sentinel (`undefined`, since
 * they're all `maybe*` types), which the worker can't interpret — it has no
 * session to resolve against. This hands it concrete values instead, with no per-slot
 * bookkeeping, so adding a promotable worker-consumed slot needs no rpcProps
 * change and can't silently ship a sentinel. Main-thread only (the cascade
 * consults the session). Display-only promotable slots the worker never reads
 * (e.g. displayMode) are still excluded by the caller — resolving them here is a
 * harmless no-op since they're dropped anyway.
 *
 * The return type is branded (`ResolvedConfigSnapshot`) so a payload builder can
 * demand a snapshot that has been through here. The assertion below is the one
 * place the brand is applied, and it sits on the line after the resolve.
 */
export function getConfigSnapshotWithPromotables(
  self: ResolvableDisplay,
): ResolvedConfigSnapshot {
  // the unresolved walk: this is the one place allowed to snapshot a promotable
  // config, because `resolvePromotablesInto` is what resolves every such slot
  const snap = fullConfSnapshot(self.configuration)
  resolvePromotablesInto(cascadeContextFor(self), snap)
  return snap as ResolvedConfigSnapshot
}

/**
 * The subsystem's one resolve loop: every promotable slot of `ctx.config`
 * written into `snap` in place, returning the slots whose value came from a
 * promoted default rather than from the config. Both serialization boundaries
 * are this function over a different context — a display state node for the
 * worker payload, a bare display config for the About dialog's copy.
 */
function resolvePromotablesInto(
  ctx: CascadeContext,
  snap: Record<string, unknown>,
): string[] {
  const inherited: string[] = []
  for (const slot of promotableSlotNames(ctx.config)) {
    const res = resolveSlotIn(ctx, slot)
    snap[slot] = res.value
    if (res.inherited) {
      inherited.push(slot)
    }
  }
  return inherited
}

/**
 * #api core/configuration
 * A track config snapshot with every display's `promotable` slots resolved, plus
 * the list of values that came from a session-wide default rather than from the
 * config itself.
 *
 * For handing a track's config to somewhere that leaves the cascade for good —
 * the About dialog's "Copy config", whose output a user pastes into a
 * `config.json`. A raw `getSnapshot` records a slot a track merely *follows* as
 * absent (`stripDefault` collapsed it), so the copied config renders differently
 * from the track it was copied from. This is `getComputedStyle` at that
 * boundary, and `fromDisplayTypeDefaults` is what lets the UI say so rather than
 * silently materializing a session preference into a track config.
 *
 * Resolves from the display *config* alone, whether or not the track is open.
 * Everything the cascade takes is on the config node: it is the same node an
 * open display's `configuration` points at (the hydration cache makes it
 * stable), its `type` is the display type the session-wide tier is keyed on
 * (every display schema is `explicitlyTyped` under the display type's own name),
 * and the session is passed in. So an unopened track — which has no display
 * state at all — still has an answer to "what would this render as", by the same
 * code path.
 *
 * **Writes every promotable slot, including the ones sitting at `promotedBase`,
 * and that is the decision — don't "align" it with the share bake.** A pasted
 * `config.json` is read by a mechanism with no cascade in it at all, so writing
 * only the inherited values would leave every other slot to pick up whatever the
 * reader has promoted in their own browser. Pinned by
 * `products/jbrowse-web/src/tests/CopyConfigPromotedDefaults.test.ts`.
 */
export interface TrackConfigWithPromotables {
  config: Record<string, unknown>
  /** `<displayType>.<slot>`, one per value inherited from a promoted default */
  fromDisplayTypeDefaults: string[]
}

/**
 * #api core/configuration
 * See {@link TrackConfigWithPromotables}.
 */
export function getTrackConfigWithPromotables(
  session: PromotedDefaultStore,
  trackConfig: AnyConfigurationModel,
): TrackConfigWithPromotables {
  const config: Record<string, unknown> = structuredClone(
    getSnapshot(trackConfig),
  )
  const fromDisplayTypeDefaults: string[] = []
  const displayConfigs: unknown = trackConfig.displays
  const displaySnaps = config.displays
  // a config with no `displays` (an assembly, a plain customized About config)
  // has no promotable slot to resolve — every one of them is display-level
  if (Array.isArray(displayConfigs) && Array.isArray(displaySnaps)) {
    for (const [i, displayConfig] of displayConfigs.entries()) {
      const snap: unknown = displaySnaps[i]
      if (!isConfigurationModel(displayConfig) || !isObject(snap)) {
        continue
      }
      // off the live config node, not off `snap` — the snapshot is what this
      // function *writes*, so the key it resolves against shouldn't depend on
      // what survived `stripDefault` on the way out. A display schema is
      // `explicitlyTyped`, so the node always carries `type`; reading the
      // snapshot's copy meant a display whose `type` ever stopped being emitted
      // got skipped whole, and a skipped display is a copied config that
      // silently isn't flattened. Same source `cascadeContextFor` reads.
      const displayType: unknown = displayConfig.type
      if (typeof displayType === 'string') {
        const ctx = { config: displayConfig, displayType, defaults: session }
        for (const slot of resolvePromotablesInto(ctx, snap)) {
          fromDisplayTypeDefaults.push(`${displayType}.${slot}`)
        }
      }
    }
  }
  return { config, fromDisplayTypeDefaults }
}

/**
 * Open displays of this display's type, **one entry per track**.
 *
 * A track open in two views is two display *models* over one display *config* —
 * `TrackConfigurationReference` resolves both through the hydration cache
 * (ADR-031) — so the raw walk yields it twice. That is the ordinary case in a
 * breakpoint-split view, which shows the same track in both halves and is one of
 * the composite shapes `openPromotableDisplays` recurses into. Every caller here
 * either counts these or writes their config, and both go wrong on a duplicate:
 * the snackbar offered to act on "2 customized tracks" over a single track, and
 * the second write was a no-op against a node the first had already set.
 *
 * Keying on the config node rather than on `trackId` is what keeps this
 * cast-free: the node is a member of `ResolvableDisplay`, and within one display
 * type it is 1:1 with the track.
 */
function openTracksOfType(self: ResolvableDisplay): ResolvableDisplay[] {
  const byTrack = new Map<AnyConfigurationModel, ResolvableDisplay>()
  for (const display of openPromotableDisplays(getSession(self))) {
    if (display.type === self.type) {
      byTrack.set(display.configuration, display)
    }
  }
  return [...byTrack.values()]
}

/**
 * Unset each display's own value on `slot`, so it follows the display type's
 * default instead of baking in a value that wouldn't track a later default
 * change. Backs the snackbar's "apply to open tracks" action. Displays already
 * unset are skipped. Takes the display set explicitly so it's unit-testable.
 *
 * Clearing the slot is the whole of it — this is the subsystem's only write to a
 * display, and it goes through the config.
 *
 * Skips dead displays, since the caller supplies the list and MST throws on any
 * read or write to a destroyed node.
 */
export function resetSlotToInherit(
  displays: ResolvableDisplay[],
  slot: string,
): void {
  for (const display of displays.filter(display => isAlive(display))) {
    // the stored value, because this asks only "is the slot set at all?" — a
    // question a `jexl:` value has to answer without being evaluated (this
    // caller has no feature context). Not `isSlotCustomized` either,
    // deliberately: a stored value that fails the usability gate reads as
    // not-customized, and clearing it out is exactly what should happen to it.
    if (storedSlotValue(display.configuration, slot) !== undefined) {
      setConf(display, slot, undefined)
    }
  }
}

/**
 * Whether `value` is the current session default for `slot`. The live state the
 * pin's filled/outline reflects — a session-wide fact, so it reads the raw
 * promoted default rather than what this display resolves to (a customized track
 * can be showing something else entirely). Module-internal (exercised by
 * promotableDefaults.test.ts); not part of the public barrel.
 */
export function isPromotableDefault(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
): boolean {
  return deepEqual(resolveSlot(self, slot).promoted, value)
}

/**
 * Open tracks (across all views) whose resolved value for `slot` differs from
 * `value` — the ones "Override N customized tracks" would visibly change by
 * clearing their own values. Drives that action's count. Module-internal
 * (exercised by promotableDefaults.test.ts); not part of the public barrel.
 *
 * Reads the **resolved** value, which is what makes this the *override* set
 * rather than the *apply* set: a track merely following the promoted default
 * already resolves to `value` and so is absent here, correctly — it needs no
 * clearing. {@link applySlotToOpenTracks} wants the opposite question and asks
 * it of the stored value.
 */
export function tracksDifferingFrom(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
): ResolvableDisplay[] {
  return openTracksOfType(self).filter(
    display => !deepEqual(resolveSlot(display, slot).value, value),
  )
}

/**
 * Write `value` into each display's own config for `slot`, so the track *holds*
 * it rather than resolving it through the cascade. The additive mirror of
 * {@link resetSlotToInherit}, and the write behind the snackbar's "apply to N
 * open tracks instead" — those tracks keep the value once the promoted default
 * that offered it is gone.
 *
 * **A track already showing `value` still has to be written**, which is why this
 * compares the *stored* value and not the resolved one. A follower stores
 * nothing and resolves `value` only through the promoted default, so skipping it
 * and then clearing that default would strand it at base — the exact opposite of
 * what the user asked for. Comparing the stored value is also what lets a
 * `jexl:` value answer "is this already what we would write?" without being
 * evaluated, the reason `resetSlotToInherit` reads the same field.
 *
 * Skips dead displays, since the caller supplies the list and MST throws on any
 * read or write to a destroyed node.
 */
export function applySlotToOpenTracks(
  displays: ResolvableDisplay[],
  slot: string,
  value: unknown,
): void {
  for (const display of displays.filter(display => isAlive(display))) {
    if (!deepEqual(storedSlotValue(display.configuration, slot), value)) {
      setConf(display, slot, value)
    }
  }
}

/**
 * Set (or clear) a value as the display type's default for `slot`. **Purely a
 * write to the session-wide default — no track's own value is ever touched**, so
 * the pin stays symmetric and pin-then-unpin can't discard one (ADR-048: the pin
 * edits the stylesheet, never the elements). Followers pick the new value up on
 * their next `resolveConf` read; customized tracks keep theirs, and the snackbar
 * is the one place in the subsystem that rewrites them.
 *
 * The snackbar carries up to two actions, and they are the subsystem's two ways
 * of spending the same click. Both re-derive everything inside `onClick` rather
 * than closing over it, because the snackbar outlives the click that raised it —
 * ADR-048 has the three ways that goes wrong.
 */
function applyDefaultToggle(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
  on: boolean,
): void {
  const session = getSession(self)
  session.setDisplayTypeDefault(self.type, slot, on ? value : undefined)
  if (!on) {
    session.notify('Cleared the default', 'info')
    return
  }
  const actions: SnackAction[] = []
  // includes the display the pin was clicked from, when it holds its own value
  const differing = tracksDifferingFrom(self, slot, value).length
  if (differing) {
    actions.push({
      // named for what it does: this clears those tracks' own values, a bulk
      // non-undoable discard. "Apply to N open tracks" read as additive, and
      // now names the action below, which genuinely is
      name: `Override ${differing} customized ${pluralize(differing, 'track')}`,
      onClick: () => {
        if (isAlive(self) && isPromotableDefault(self, slot, value)) {
          resetSlotToInherit(tracksDifferingFrom(self, slot, value), slot)
        }
      },
    })
  }
  // The scope choice: take the value without taking the default. Offered only
  // with a sibling to apply it to — with one track open, "these tracks" and
  // "this display type" name the same set, so the distinction the action exists
  // to offer isn't there, and the toast stays auto-hiding as it was.
  const open = openTracksOfType(self).length
  if (open > 1) {
    actions.push({
      name: `Apply to ${open} open ${pluralize(open, 'track')} instead`,
      onClick: () => {
        // same guard as its sibling, and for the same reason: the action means
        // "instead of the default I just set", so with that default already
        // gone or moved it must do nothing rather than write a value nobody
        // asked for.
        if (isAlive(self) && isPromotableDefault(self, slot, value)) {
          // write first, then clear: the followers are only holding `value`
          // by way of the default, so clearing it first would drop them to
          // base and the write would be re-adding what the user could see
          applySlotToOpenTracks(openTracksOfType(self), slot, value)
          session.setDisplayTypeDefault(self.type, slot, undefined)
        }
      },
    })
  }
  session.notify(
    'Set as the default',
    'info',
    actions.length ? actions : undefined,
  )
}

/**
 * #api core/configuration
 * The pin for one promotable slot: "make this value the default for every track
 * of this display type".
 *
 * `value` chooses between the subsystem's two meanings, which are otherwise
 * identical:
 *
 * - **Give it** for a per-value pin — "make *arcs* the default" — independent of
 *   what the track currently shows. Use on an always-visible pin so it can never
 *   promote a meaningless value, and so two rows sharing one slot (arcs `'arc'`
 *   vs read cloud `'cloud'`; sashimi `'down'` vs `'auto'`) stay independent.
 * - **Omit it** for "whatever I'm showing", resolved through the cascade. Use for
 *   a symmetric or continuous setting where no fixed on-value makes sense
 *   (wiggle point size, arc line width, `mismatchAlpha`).
 *
 * One function with an optional argument, rather than the two exported builders
 * it replaces — a per-value one and a `…CurrentValue…` one, the second of which
 * was exactly the first applied to `resolveSlot(self, slot).value`. The pair was
 * one function plus a doc section explaining which name to reach for; omitting
 * the argument now says what the longer name said.
 */
export function makePin<
  CONFMODEL extends AnyConfigurationModel,
  SLOT extends ConfigurationSlotName<ConfigurationSchemaForModel<CONFMODEL>>,
>(
  self: ResolvableDisplay<CONFMODEL>,
  slot: SLOT,
  ...value:
    | []
    | [
        ConfigurationSlotValueResolved<
          ConfigurationSchemaForModel<CONFMODEL>,
          SLOT
        >,
      ]
): Pin {
  // One walk of the cascade feeds both halves. The value-omitted form's
  // on-value IS the settled value, and `active` compares against the raw
  // promoted default of that same resolution — taking the two from separate
  // `resolveSlot` calls read as though they could disagree, and cost a second
  // walk per pin on a menu that builds a dozen of them.
  const res = resolveSlot(self, slot)
  // rest-tuple, not `value?: unknown`: the promote-current case has to stay
  // distinguishable from an explicit `undefined` rather than collapsing into it.
  const onValue = value.length ? value[0] : res.value
  // The value-omitted form can't fail this — the cascade only ever settles on a
  // usable value — so this is entirely about a caller-supplied one. An on-value
  // the cascade would refuse builds a pin that is inert *and* silent: clicking
  // it stores a key `resolveSlotIn` then drops, so no track moves and the pin
  // draws outline forever. The reachable mistakes are the inherit sentinel
  // itself (`makePin(self, slot, undefined)`, which additionally reads as the
  // default the moment nothing is promoted, so it draws *filled* and does
  // nothing), a non-finite number, and a value outside a `maybeStringEnum`'s
  // vocabulary. The `value` parameter's type catches those wherever the slot
  // resolves to a real value type; what is left for runtime is the slot whose
  // schema widened to `any` — a `frozen`/`maybeFrozen` one by design, or a
  // display whose config model was not narrowed. Same bargain `ConfigSlot`
  // strikes over `promotedBase`, which is this gate at the other end.
  if (!isPromotableValue(self.configuration, slot, onValue)) {
    throw new Error(
      `cannot pin ${JSON.stringify(onValue)} as the default for config slot "${slot}": the cascade refuses it, so the pin could never light up`,
    )
  }
  // `isPromotableDefault` off the resolution already in hand — same comparison,
  // same `deepEqual`, no second walk. The snackbar below still calls the named
  // predicate, because it must re-derive the answer at click time.
  const active = deepEqual(res.promoted, onValue)
  return {
    slot,
    onValue,
    active,
    toggle: () => {
      applyDefaultToggle(self, slot, onValue, !active)
    },
  }
}

/**
 * #api core/configuration
 * Effective differences a track following the default inherits from session-wide
 * defaults, one per promotable slot whose inherited value differs from its schema
 * default. Drives the track-selector "affected by a session default" badge.
 */
export function getDisplayTypeDefaultChanges(
  self: ResolvableDisplay,
): TrackConfigChange[] {
  const changes: TrackConfigChange[] = []
  for (const slot of promotableSlotNames(self.configuration)) {
    const res = resolveSlot(self, slot)
    if (res.inherited) {
      changes.push({
        path: [slot],
        // a cascade value is `unknown` here but JSON by contract — it has to
        // survive `postMessage` to a worker. Asserted per field rather than on
        // the whole entry, so `path` stays type-checked.
        from: res.base as TrackConfigChange['from'],
        to: res.value as TrackConfigChange['to'],
      })
    }
  }
  return changes
}

/**
 * #api core/configuration
 * Clear the named promoted defaults for this display type, so every track
 * following one reverts to its own config value. Backs the badge's "clear
 * session default" action, which passes the slots it actually listed
 * (`getDisplayTypeDefaultChanges`).
 *
 * **`slots` is required, and an all-slots default is not the convenience it
 * looks like.** It reaches further than any list a dialog can have shown: a
 * promoted default the track *customized* over, or one promoted to a value
 * equal to `promotedBase`, is `inherited: false` and so appears in no row, yet
 * still governs sibling tracks — so clearing it from a dialog that never showed
 * it moves tracks other than the one whose badge was clicked. Clearing every
 * promoted default at once is a preferences-scope action, and Preferences →
 * "Reset to defaults" is where it lives (`clearPreferenceOverrides`).
 */
export function clearPromotedDefaults(
  self: ResolvableDisplay,
  slots: Iterable<string>,
): void {
  const session = getSession(self)
  for (const slot of slots) {
    session.setDisplayTypeDefault(self.type, slot, undefined)
  }
}
