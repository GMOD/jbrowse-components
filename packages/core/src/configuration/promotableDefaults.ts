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
import { pluralize } from '../util/stringUtils.ts'
import { isViewContainer } from '../util/types/index.ts'
import { setConf } from './getConf.ts'
import {
  cascadeContextFor,
  resolveSlot,
  resolveSlotIn,
  storedSlotValue,
} from './promotableResolve.ts'
import {
  fullConfSnapshot,
  isConfigurationModel,
  promotableSlotNames,
} from './util.ts'

import type { AbstractSessionModel } from '../util/index.ts'
import type { TrackConfigChange } from '../util/trackConfigDelta.ts'
import type { CascadeContext, ResolvableDisplay } from './promotableResolve.ts'
import type { AnyConfigurationModel } from './types.ts'

/**
 * #api core/configuration
 * Whether this track has customized the slot (holds a non-default value of its
 * own) rather than following the display type's default. The correct "reset to
 * default" predicate for a promotable slot: comparing the resolved value to the
 * base instead reads as at-default for a track merely *following* a non-base
 * promoted default, so the reset control lights up on a no-op.
 */
export function isSlotCustomized(
  self: ResolvableDisplay,
  slot: string,
): boolean {
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
 * and that is the decision — don't "align" it with the share bake.** The bake
 * writes only genuinely-inherited values, because a baked value reads as
 * customized on the recipient's side and an at-base slot needs nothing. A pasted
 * `config.json` is read by a *different mechanism* — there is no cascade there at
 * all — so writing only the inherited ones would leave every other slot to pick
 * up whatever the reader has promoted in their own browser. What a user copying a
 * config wants is the values they are looking at. The cost is that the pasted
 * track is customized on those slots and no longer follows a later promoted
 * default, which is what a config file means.
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
  session: AbstractSessionModel,
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
      const displayType = isObject(snap) ? snap.type : undefined
      if (
        isConfigurationModel(displayConfig) &&
        isObject(snap) &&
        typeof displayType === 'string'
      ) {
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
 * A promotable "default for all tracks of this type" control, bundled so a menu
 * row's trailing pin consumes it as a single prop. `active` = this value is
 * currently the session default (a filled pin); `toggle` sets it as the default
 * or clears it, touching no track's own value (see `applyDefaultToggle`). On
 * set it raises a snackbar with an "Override N customized tracks" action for every
 * open track not already showing this value — that action is the only thing in
 * the subsystem that rewrites a track.
 */
export interface DisplayTypeDefaultControl {
  active: boolean
  toggle: () => void
}

// A view whose open tracks we can enumerate. The generic view interface doesn't
// surface `tracks`, so narrow structurally — the declared display shape is the
// same ResolvableDisplay the cascade already operates on.
//
// Checks the elements, not just that `tracks` is an array: this narrowing is
// what every consumer downstream trusts, and an element without `displays`
// would put `undefined` in the walk and throw at the first `display.type` —
// inside a share/export bake, i.e. as far from the cause as it gets. Every
// `tracks`-bearing view today holds real track models, so this only ever
// confirms what is already true.
function hasOpenTracks<T extends object>(
  view: T,
): view is T & { tracks: { displays: ResolvableDisplay[] }[] } {
  return (
    'tracks' in view &&
    Array.isArray(view.tracks) &&
    view.tracks.every(t => isObject(t) && Array.isArray(t.displays))
  )
}

// A composite view holding child views in a `views` array: breakpoint-split and
// the linear-comparative family incl. synteny. Not exclusive with
// `hasOpenTracks`: LinearComparativeView has both its own synteny tracks and two
// child LGVs.
//
// A view that holds its children under *named* props instead (SvInspectorView's
// `spreadsheetView`/`circularView`) is NOT reached. Enumerating a view's own
// properties to find them isn't an option — reading every key of an MST node
// invokes every computed view on it, several of which throw before the view is
// initialized. No display reachable that way declares a promotable slot today,
// so nothing is currently missed; if one ever does, give that view a `views`
// getter returning its children rather than duck-typing harder here.
function hasChildViews<T extends object>(
  view: T,
): view is T & { views: object[] } {
  return (
    'views' in view &&
    Array.isArray(view.views) &&
    view.views.every(v => typeof v === 'object' && v !== null)
  )
}

function displaysInView(view: object): ResolvableDisplay[] {
  return [
    ...(hasOpenTracks(view) ? view.tracks.flatMap(t => t.displays) : []),
    ...(hasChildViews(view) ? view.views.flatMap(displaysInView) : []),
  ]
}

/**
 * #api core/configuration
 * Every display on an open track, across all open views — the reach of anything
 * that acts on "the tracks the user is looking at": the cascade's own "apply to
 * open tracks", and the share/export bake. One walk so those can't drift apart.
 *
 * Recurses into composite views. A display nested in one resolves the cascade
 * like any other but was invisible to both callers, so the share/export bake
 * didn't bake its inherited values and a shared session containing a
 * breakpoint-split or synteny view rendered differently for the recipient.
 * `LGVSyntenyDisplay` is only ever reached through this branch, so don't flatten
 * the recursion away. `hasChildViews` names the one composite shape it does not
 * cover.
 *
 * A view holding neither (e.g. spreadsheet) drops out via the structural guards.
 * A view whose displays declare no promotable slot (e.g. dotplot, which does
 * hold tracks) is walked and contributes nothing — harmless, and cheaper than
 * asking each display whether it has anything to promote.
 */
export function openPromotableDisplays(
  session: AbstractSessionModel,
): ResolvableDisplay[] {
  const views = isViewContainer(session) ? session.views : []
  return views.flatMap(displaysInView)
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
 * display, and it goes through the config. It used to also lift a per-display
 * `ignorePromotedDefaults` opt-out, which is what made a write-capable
 * `PromotableDisplay` shape necessary; with that flag gone, a received track
 * rejoins the cascade by having nothing to reject it.
 *
 * Dead displays are skipped rather than trusted: the "apply to open tracks"
 * snackbar can outlive a track the user closes in the meantime, and both reads
 * and writes throw on a destroyed MST node.
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
 */
export function tracksDifferingFrom(
  self: ResolvableDisplay,
  slot: string,
  value: unknown,
): ResolvableDisplay[] {
  return openDisplaysOfType(self).filter(
    display => !deepEqual(resolveSlot(display, slot).value, value),
  )
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
 * Per-value control: "make `slot === onValue` the session default". The meaning
 * is per-value ("make arcs the default"), independent of the track's current
 * value — so an always-visible control never promotes a meaningless value, and
 * two toggles sharing one slot (arcs vs read cloud) stay independent.
 */
export function makeDisplayTypeDefaultControl(
  self: ResolvableDisplay,
  slot: string,
  onValue: unknown,
): DisplayTypeDefaultControl {
  const active = isPromotableDefault(self, slot, onValue)
  return {
    active,
    toggle: () => {
      applyDefaultToggle(self, slot, onValue, !active)
    },
  }
}

/**
 * #api core/configuration
 * Promote-current control: "make this track's current resolved value the
 * session default". Use for a symmetric setting (a `maybeBoolean` toggle, or a
 * multi-mode slot like displayMode) where the pin means "whatever I'm showing",
 * not a fixed on-value.
 */
export function makeCurrentValueDisplayTypeDefaultControl(
  self: ResolvableDisplay,
  slot: string,
): DisplayTypeDefaultControl {
  return makeDisplayTypeDefaultControl(
    self,
    slot,
    resolveSlot(self, slot).value,
  )
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
