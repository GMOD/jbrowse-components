import { isAlive } from '@jbrowse/mobx-state-tree'

import { deepEqual } from '../util/deepEqual.ts'
import { getSession, isViewContainer, pluralize } from '../util/index.ts'
import { setConf } from './getConf.ts'
import { resolveSlot, storedSlotValue } from './promotableResolve.ts'
import { fullConfSnapshot, promotableSlotNames } from './util.ts'

import type { AbstractSessionModel } from '../util/index.ts'
import type { TrackConfigChange } from '../util/trackConfigDelta.ts'
import type { PromotableDisplay } from './promotableResolve.ts'

/**
 * Session-wide "promoted defaults" for display-type config slots — the UI /
 * control layer over the read-time cascade in `promotableResolve.ts`. A
 * `promotable` slot resolves through three tiers (track's own customized value
 * -> session-wide default for this display type -> base); a display reads the
 * resolved value with `resolveConf` (a thin reader over `resolveSlot`), and the
 * session store (`get/setDisplayTypeDefault`) holds the
 * promoted value. Everything here reads a field off `resolveSlot`.
 */

/**
 * #api core/configuration
 * Whether this track has customized the slot (holds a non-default value of its
 * own) rather than following the display type's default. The correct "reset to
 * default" predicate for a promotable slot: comparing the resolved value to the
 * base instead reads as at-default for a track merely *following* a non-base
 * promoted default, so the reset control lights up on a no-op.
 */
export function isSlotCustomized(
  self: PromotableDisplay,
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
  self: PromotableDisplay,
): Record<string, unknown> {
  // the unresolved walk: this is the one place allowed to snapshot a promotable
  // config, because the loop below is what resolves every such slot
  const snap = fullConfSnapshot(self.configuration)
  for (const slot of promotableSlotNames(self.configuration)) {
    // a callback slot keeps its raw `jexl:` string: the worker evaluates it
    // per-feature, and there's no per-feature context to resolve it here
    const res = resolveSlot(self, slot)
    if (!res.callback) {
      snap[slot] = res.value
    }
  }
  return snap
}

/** one slot value a promotable-default control promotes */
export interface PromotableEntry {
  slot: string
  value: unknown
}

/**
 * #api core/configuration
 * A promotable "default for all tracks of this type" control, bundled so a menu
 * row's trailing pin consumes it as a single prop. `active` = this value is
 * currently the session default (a filled pin); `toggle` sets it as the default
 * or clears it, touching no track's own value (see `applyDefaultToggle`). On
 * set it raises a snackbar with an "Apply to N open tracks" action for every
 * open track not already showing this value — that action is the only thing in
 * the subsystem that rewrites a track.
 */
export interface DisplayTypeDefaultControl {
  active: boolean
  /**
   * there is nothing this pin could promote right now, so it renders greyed
   * with an explanatory tooltip instead of being hidden (same
   * disabled-not-hidden rule the dependent menu options follow). Only the
   * promote-current builder can produce it, on a track whose slot holds a
   * `jexl:` callback — that has no single current value to promote.
   */
  disabled: boolean
  toggle: () => void
}

// A view whose open tracks we can enumerate. The generic view interface doesn't
// surface `tracks`, so narrow structurally — the declared display shape is the
// same PromotableDisplay the cascade already operates on.
function hasOpenTracks<T extends object>(
  view: T,
): view is T & { tracks: { displays: PromotableDisplay[] }[] } {
  return 'tracks' in view && Array.isArray(view.tracks)
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

function displaysInView(view: object): PromotableDisplay[] {
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
 * Recurses into composite views, because a display nested in one resolves the
 * cascade at read time like any other but was invisible to both callers: "apply
 * to N open tracks" undercounted it, and — the real bug — the share/export bake
 * neither baked its inherited values nor flagged it `ignorePromotedDefaults`, so
 * a shared session containing a breakpoint-split or synteny view rendered
 * differently for the recipient. `LGVSyntenyDisplay` (a promotable adopter) is
 * only ever reached through this branch. See `hasChildViews` for the one
 * composite shape the recursion does not cover.
 *
 * Views that show no tracks at all (e.g. dotplot) drop out via the structural
 * guards. In practice a track has one display (`replaceDisplay` swaps in place,
 * `activeDisplay` is `displays[0]`), so the inner flatMap just collects each
 * track's display without relying on multiple-per-track.
 */
export function openPromotableDisplays(
  session: AbstractSessionModel,
): PromotableDisplay[] {
  const views = isViewContainer(session) ? session.views : []
  return views.flatMap(displaysInView)
}

function openDisplaysOfType(self: PromotableDisplay): PromotableDisplay[] {
  return openPromotableDisplays(getSession(self)).filter(
    display => display.type === self.type,
  )
}

/**
 * Unset each display's own value on `slots`, so it follows the display type's
 * default instead of baking in a value that wouldn't track a later default
 * change. Backs the snackbar's "apply to open tracks" action. Displays already
 * unset are skipped. Takes the display set explicitly so it's unit-testable.
 *
 * Also lifts `ignorePromotedDefaults` on a display that arrived in a received
 * session: every caller reaches here from a deliberate "use this default"
 * click, and that opt-out only exists to stop defaults applying *silently*.
 * Without this the reset would strand such a display on its base value —
 * cleared of its own value, yet still refusing the default it was just told to
 * follow.
 *
 * Dead displays are skipped rather than trusted: the "apply to open tracks"
 * snackbar can outlive a track the user closes in the meantime, and both reads
 * and writes throw on a destroyed MST node.
 */
export function resetSlotsToInherit(
  displays: PromotableDisplay[],
  slots: string[],
): void {
  for (const display of displays.filter(display => isAlive(display))) {
    display.setIgnorePromotedDefaults(false)
    for (const slot of slots) {
      // the stored value, because this asks only "is the slot set at all?" — a
      // question a `jexl:` value has to answer without being evaluated (this
      // caller has no feature context). Not `isSlotCustomized` either,
      // deliberately: a stored value that fails the usability gate reads as
      // not-customized, and clearing it out is exactly what should happen to it.
      if (storedSlotValue(display, slot) !== undefined) {
        setConf(display, slot, undefined)
      }
    }
  }
}

/**
 * Whether every value in `entries` is the current session default for its slot.
 * The live state the pin's filled/outline reflects — a session-wide fact, so it
 * reads the raw promoted default and ignores this display's
 * `ignorePromotedDefaults` opt-out (which only governs what the display
 * *follows*). Module-internal (exercised by promotableDefaults.test.ts); not
 * part of the public barrel.
 */
export function isPromotableDefault(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): boolean {
  // an empty group is vacuously true for `.every`, which would render a *filled*
  // pin whose toggle then announces "Cleared the default" — report "not the
  // default" instead, since nothing is
  return (
    entries.length > 0 &&
    entries.every(({ slot, value }) =>
      deepEqual(resolveSlot(self, slot).promoted, value),
    )
  )
}

/**
 * Open tracks (across all views) whose resolved value differs from `entries` —
 * the ones "apply to open tracks" would visibly change by resetting them to
 * follow the default. Drives that action's count. Module-internal (exercised by
 * promotableDefaults.test.ts); not part of the public barrel.
 */
export function tracksDifferingFrom(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): PromotableDisplay[] {
  return openDisplaysOfType(self).filter(display =>
    entries.some(({ slot, value }) => {
      // a callback track shows a per-feature value, so it never *is* this one
      // value — count it as differing without evaluating it
      const res = resolveSlot(display, slot)
      return res.callback || !deepEqual(res.value, value)
    }),
  )
}

/**
 * Set (or clear) a value combination as the display type's default. **Purely a
 * write to the session-wide default — no track's own value is ever touched.**
 * Tracks that follow the default pick the new value up immediately via
 * `resolveConf`; tracks the user has customized keep theirs. If any open track isn't
 * already showing this value, the snackbar offers an "Apply to N open tracks"
 * action, which is the one explicit gesture that rewrites tracks. Clearing just
 * notifies.
 *
 * Toggling on used to *also* reset the clicking display to inherit, so its own
 * track updated with one click. That silently discarded that display's value:
 * pin-then-unpin left it at `promotedBase` rather than what it held before —
 * a two-click, non-undoable loss from a control that reads as a toggle. Keeping
 * the pin symmetric (it edits the stylesheet, never the elements) costs one
 * extra click on a customized track and removes the whole failure mode; that
 * track is now simply counted in "Apply to N open tracks" like any other.
 */
function applyDefaultToggle(
  self: PromotableDisplay,
  entries: PromotableEntry[],
  on: boolean,
): void {
  const session = getSession(self)
  const slots = entries.map(e => e.slot)
  // the whole write: set (or clear) the session-wide default for each slot.
  // Non-destructive — no track's own value is touched, so a following track
  // picks it up on its next `resolveConf` read and a customized one keeps theirs
  for (const { slot, value } of entries) {
    session.setDisplayTypeDefault?.(self.type, slot, on ? value : undefined)
  }
  if (on) {
    // open tracks not already showing this value — those the "apply to open
    // tracks" action would visibly change by making them follow the new default.
    // Includes the display the pin was clicked from when it holds its own value.
    const n = tracksDifferingFrom(self, entries).length
    if (n) {
      session.notify('Set as the default', 'info', {
        name: `Apply to ${n} open ${pluralize(n, 'track')}`,
        // re-derived on click, not captured: the snackbar outlives the click
        // that raised it, so a track closed (or newly opened) in between would
        // otherwise be reset as a dead node / silently skipped. `self` is the
        // display the pin was clicked from, and it can be the one that closed —
        // the whole walk hangs off its session, so guard it too.
        //
        // And the default itself can be gone by then (the user unpinned, or
        // pinned a sibling value on the same slot). This action only ever means
        // "make these tracks follow the default I just set", so with that default
        // no longer in place it does nothing — clearing their own values would
        // strand them on whatever replaced it, discarding customizations to reach
        // a value nobody asked for.
        onClick: () => {
          if (isAlive(self) && isPromotableDefault(self, entries)) {
            resetSlotsToInherit(tracksDifferingFrom(self, entries), slots)
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
 * Per-value control over a *group* of slots: "make this exact combination of
 * slot values the session default". `active` reflects whether this exact
 * combination is the current default; `toggle` flips it (set/clear,
 * non-destructive). The base builder the two public wrappers below delegate to;
 * module-internal (exercised by promotableDefaults.test.ts) because no adopter
 * promotes more than one slot behind a single pin — feature-height presets once
 * grouped `featureHeight` + `featureSpacing` here, but `featureSpacing` is now
 * derived from `featureHeight` rather than stored. Export it again if a genuine
 * multi-slot pin appears.
 */
export function makeSlotsValueDisplayTypeDefaultControl(
  self: PromotableDisplay,
  entries: PromotableEntry[],
): DisplayTypeDefaultControl {
  const active = isPromotableDefault(self, entries)
  return {
    active,
    disabled: false,
    toggle: () => {
      applyDefaultToggle(self, entries, !active)
    },
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
  self: PromotableDisplay,
  slot: string,
  onValue: unknown,
): DisplayTypeDefaultControl {
  return makeSlotsValueDisplayTypeDefaultControl(self, [
    { slot, value: onValue },
  ])
}

/**
 * #api core/configuration
 * Promote-current control: "make this track's current resolved value(s) the
 * session default". Use for a symmetric setting (a `maybeBoolean` toggle, or a
 * multi-mode slot like displayMode) where the pin means "whatever I'm showing",
 * not a fixed on-value. Groups multiple slots behind one control.
 *
 * A `jexl:` slot has no current value to promote — it computes a different one
 * per feature, and this builder runs while a track menu is being assembled, with
 * no feature to supply — so it disables the pin instead. The resolution union
 * offers no `.value` on that branch, so this is a case the type makes you
 * handle rather than one you have to remember.
 */
export function makeCurrentValueDisplayTypeDefaultControl(
  self: PromotableDisplay,
  slots: string[],
): DisplayTypeDefaultControl {
  const entries: PromotableEntry[] = []
  for (const slot of slots) {
    const res = resolveSlot(self, slot)
    if (!res.callback) {
      entries.push({ slot, value: res.value })
    }
  }
  // a callback slot contributes no entry, so a short list means at least one of
  // them has no current value to promote
  return entries.length < slots.length
    ? { active: false, disabled: true, toggle: () => {} }
    : makeSlotsValueDisplayTypeDefaultControl(self, entries)
}

/**
 * #api core/configuration
 * Effective differences a track following the default inherits from session-wide
 * defaults, one per promotable slot whose inherited value differs from its schema
 * default. Drives the track-selector "affected by a session default" badge.
 */
export function getDisplayTypeDefaultChanges(
  self: PromotableDisplay,
): TrackConfigChange[] {
  const changes: TrackConfigChange[] = []
  for (const slot of promotableSlotNames(self.configuration)) {
    // `customized` first: a customized slot inherits nothing. It also narrows
    // the callback branch away (which is always customized), which is what makes
    // `.value` readable here — this caller has no context to evaluate one with
    const res = resolveSlot(self, slot)
    if (!res.customized && !deepEqual(res.value, res.base)) {
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
 * Clear every promoted default for this display type, so sibling tracks revert
 * to their own config values. Backs the badge's "clear default" action.
 */
export function clearPromotedDefaults(self: PromotableDisplay): void {
  const session = getSession(self)
  for (const slot of promotableSlotNames(self.configuration)) {
    session.setDisplayTypeDefault?.(self.type, slot, undefined)
  }
}
