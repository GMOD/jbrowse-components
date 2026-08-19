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
 */
export function getConfigSnapshotWithPromotables(
  self: ResolvableDisplay,
): Record<string, unknown> {
  // the unresolved walk: this is the one place allowed to snapshot a promotable
  // config, because `resolvePromotablesInto` is what resolves every such slot
  const snap = fullConfSnapshot(self.configuration)
  resolvePromotablesInto(cascadeContextFor(self), snap)
  return snap
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
 * #api core/configuration
 * The "make this the default for all tracks of this type" affordance on a menu
 * row — the trailing `PushPin`, bundled so the row consumes it as one prop.
 * Built by {@link makePin}.
 *
 * `active` = this value is currently the session default (a filled pin);
 * `toggle` sets it as the default or clears it, touching no track's own value
 * (see `applyDefaultToggle`). On set it raises a snackbar with an "Override N
 * customized tracks" action for every open track not already showing this value
 * — that action is the only thing in the subsystem that rewrites a track.
 *
 * **`toggle` rather than a `promote`/`clear` pair**, which was tried and dropped:
 * the sole renderer is a MUI `ToggleButton` whose `onChange` means exactly
 * "flip", so splitting it adds a member *and* a branch at the one call site that
 * never needed one. `active` is already public for a caller that wants to state a
 * direction. (The house preference for explicit setters over toggles is about MST
 * actions, where a toggle destroys the ability to set a known state; nothing here
 * stores a value.) ADR-048's requirement is that the flip be *symmetric* —
 * pin-then-unpin discards nothing — not that it be two functions.
 */
export interface Pin {
  /**
   * The promotable slot this pin promotes a value of. Nothing in the UI reads
   * it — a pin renders from `active`, `onValue` and the toggle. It is here so a
   * *built menu* can be asked which promotable slots it offers a pin for, which
   * is the only way that question has an answer: declaring `promotedBase` is a
   * schema fact and the pin is a menu fact, and a display that inherits the slot
   * but never builds a row has a slot nothing can ever promote, silently
   * (`promotableSlotsWithoutPin`, guarded by
   * `products/jbrowse-web/src/tests/PromotablePinCoverage.test.ts`).
   */
  slot: string
  /**
   * The value `toggle` promotes — the on-value {@link makePin} was given, or the
   * track's current resolved value for the value-omitted form.
   *
   * `PinAdornment` words itself from this, and has to: a **boolean** on-value
   * promotes a *state*, so a row whose label names the setting rather than a
   * value ("Show legend") gets a pin that promotes hiding the legend as often as
   * showing it. Every other on-value IS what the row's label says — a radio
   * option, a slider's current size — so those keep the value-shaped copy.
   *
   * Required, like `slot`: a pin that cannot say what it promotes is what let
   * that copy state the opposite of what the click does.
   */
  onValue: unknown
  active: boolean
  toggle: () => void
}

function openDisplaysOfType(self: ResolvableDisplay): ResolvableDisplay[] {
  return openPromotableDisplays(getSession(self)).filter(
    display => display.type === self.type,
  )
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
 * `value` — the ones "apply to open tracks" would visibly change by resetting
 * them to follow the default. Drives that action's count. Module-internal
 * (exercised by promotableDefaults.test.ts); not part of the public barrel.
 *
 * **One entry per track, not per display.** A track open in two views is two
 * display *models* over one display *config* — `TrackConfigurationReference`
 * resolves both through the hydration cache to the identical node (ADR-031) —
 * so the raw walk counted it twice and the snackbar offered to "Override 2
 * customized tracks" over a single track. That is the ordinary case in a
 * breakpoint-split view, which shows the same track in both halves and is one
 * of the composite shapes `openPromotableDisplays` recurses into.
 *
 * Keying on the config node rather than on `trackId` is what keeps this
 * cast-free: the node is a member of `ResolvableDisplay`, and within one display
 * type it is 1:1 with the track. Deduping the returned displays rather than only
 * the count is what stops the two from disagreeing — clearing the slot on either
 * one writes the same node, so the extra pass was a no-op anyway.
 */
export function tracksDifferingFrom(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
): ResolvableDisplay[] {
  const byTrack = new Map<AnyConfigurationModel, ResolvableDisplay>()
  for (const display of openDisplaysOfType(self)) {
    if (!deepEqual(resolveSlot(display, slot).value, value)) {
      byTrack.set(display.configuration, display)
    }
  }
  return [...byTrack.values()]
}

/**
 * Set (or clear) a value as the display type's default for `slot`. **Purely a
 * write to the session-wide default — no track's own value is ever touched**, so
 * the pin stays symmetric and pin-then-unpin can't discard one (ADR-048: the pin
 * edits the stylesheet, never the elements). Followers pick the new value up on
 * their next `resolveConf` read; customized tracks keep theirs, and the snackbar
 * action is the one gesture in the subsystem that rewrites them.
 */
function applyDefaultToggle(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
  on: boolean,
): void {
  const session = getSession(self)
  session.setDisplayTypeDefault(self.type, slot, on ? value : undefined)
  if (on) {
    // includes the display the pin was clicked from, when it holds its own value
    const n = tracksDifferingFrom(self, slot, value).length
    if (n) {
      session.notify('Set as the default', 'info', {
        // named for what it does: this clears those tracks' own values, a bulk
        // non-undoable discard. "Apply to N open tracks" read as additive
        name: `Override ${n} customized ${pluralize(n, 'track')}`,
        // re-derived on click, never captured — the snackbar outlives the click
        // that raised it, so both the target set and the default itself can have
        // moved by now. ADR-048 for the three ways that goes wrong.
        onClick: () => {
          if (isAlive(self) && isPromotableDefault(self, slot, value)) {
            resetSlotToInherit(tracksDifferingFrom(self, slot, value), slot)
          }
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
 * Clear promoted defaults for this display type, so every track following one
 * reverts to its own config value. Backs the badge's "clear session default"
 * action, which passes the slots it actually listed
 * (`getDisplayTypeDefaultChanges`).
 *
 * Pass `slots` whenever the UI named what it was clearing. The all-slots default
 * reaches further than any such list: a promoted default the track *customized*
 * over, or one promoted to a value equal to `promotedBase`, is invisible in the
 * badge dialog (neither is `inherited`) yet still governs sibling tracks — so
 * clearing it from a dialog that never showed it changes tracks other than the
 * one whose badge was clicked.
 */
export function clearPromotedDefaults(
  self: ResolvableDisplay,
  slots: Iterable<string> = promotableSlotNames(self.configuration),
): void {
  const session = getSession(self)
  for (const slot of slots) {
    session.setDisplayTypeDefault(self.type, slot, undefined)
  }
}
