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
 * Open displays of this display's type, **one entry per track** — the set the
 * pin's click writes. Module-internal (exercised by promotableDefaults.test.ts);
 * not part of the public barrel.
 *
 * A track open in two views is two display *models* over one display *config* —
 * `TrackConfigurationReference` resolves both through the hydration cache
 * (ADR-031) — so the raw walk yields it twice. That is the ordinary case in a
 * breakpoint-split view, which shows the same track in both halves and is one of
 * the composite shapes `openPromotableDisplays` recurses into. The count reaches
 * the user in the snackbar and the set gets written, and both
 * go wrong on a duplicate: the toast offered to act on "2 tracks" over a single
 * track, and the second write was a no-op against a node the first had already
 * set.
 *
 * Keying on the config node rather than on `trackId` is what keeps this
 * cast-free: the node is a member of `ResolvableDisplay`, and within one display
 * type it is 1:1 with the track.
 */
export function openTracksOfType(self: ResolvableDisplay): ResolvableDisplay[] {
  // seeded with the clicked display so it is in the set by construction rather
  // than by the walk happening to reach it. A display the walk misses used to
  // cost nothing — the click wrote only the session default — and would now be
  // the whole of the click. A duplicate from the walk lands on the same config
  // key, so this adds no entry.
  const byTrack = new Map<AnyConfigurationModel, ResolvableDisplay>([
    [self.configuration, self],
  ])
  for (const display of openPromotableDisplays(getSession(self))) {
    if (display.type === self.type) {
      byTrack.set(display.configuration, display)
    }
  }
  return [...byTrack.values()]
}

/**
 * Whether `value` is the current session default for `slot`. The live state the
 * pin's filled/outline reflects — a session-wide fact, so it reads the raw
 * promoted default rather than what this display resolves to (a customized track
 * can be showing something else entirely). The named form of the comparison
 * {@link makePin} inlines off a resolution it already holds. Module-internal
 * (exercised by promotableDefaults.test.ts); not part of the public barrel.
 */
export function isPromotableDefault(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
): boolean {
  return deepEqual(resolveSlot(self, slot).promoted, value)
}

/**
 * Write `value` into each display's own config for `slot`, so the track *holds*
 * it rather than resolving it through the cascade. The pin's click, over every
 * open track of the display type.
 *
 * **A track already showing `value` still has to be written**, which is why this
 * compares the *stored* value and not the resolved one: a follower stores
 * nothing and is showing `value` only by way of some promoted default, so
 * skipping it would leave it to move again the moment that default changed.
 * Comparing the stored value is also what lets a `jexl:` value answer "is this
 * already what we would write?" without being evaluated.
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
 * The pin's click. Two branches, chosen by whether this value is *already* the
 * display type's promoted default:
 *
 * - **It isn't** — write `value` into every open track of the type, and offer
 *   the promotion as a snackbar action. Applying to the tracks in front of the
 *   user is the click they mean far more often, so it is the one that needs no
 *   second click; a default outlives the tracks it was set for and governs every
 *   track of the type opened later, so it is the escalation (ADR-048).
 * - **It is** — clear it, touching no track. The open tracks hold their values
 *   because the user applied them, so reverting them here would make a toggle
 *   into a bulk discard.
 *
 * The apply is one operation over *every* open track, not a labeled pair over
 * the tracks that differ and the tracks that follow. Overwriting a customized
 * track is the same write as filling in a follower, and the distinction the two
 * actions drew is not one the user has any reason to see.
 *
 * The snackbar outlives the click that raised it, so the promotion re-derives
 * `self`'s liveness inside `onClick` rather than closing over a decision —
 * ADR-048 has the ways that goes wrong.
 */
function applyPinClick(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
  isDefault: boolean,
): void {
  const session = getSession(self)
  if (isDefault) {
    session.setDisplayTypeDefault(self.type, slot, undefined)
    session.notify('Cleared the default', 'info')
  } else {
    const open = openTracksOfType(self)
    applySlotToOpenTracks(open, slot, value)
    session.notify(
      `Applied to ${open.length} open ${pluralize(open.length, 'track')}`,
      'info',
      {
        name: 'Set as the default',
        onClick: () => {
          if (isAlive(self)) {
            session.setDisplayTypeDefault(self.type, slot, value)
          }
        },
      },
    )
  }
}

/**
 * #api core/configuration
 * The pin for one promotable slot: "apply this value to every open track of this
 * display type", and — via the snackbar it raises — "keep it as the default for
 * the ones opened later".
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
  // same `deepEqual`, no second walk.
  const active = deepEqual(res.promoted, onValue)
  return {
    slot,
    onValue,
    active,
    toggle: () => {
      applyPinClick(self, slot, onValue, active)
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
