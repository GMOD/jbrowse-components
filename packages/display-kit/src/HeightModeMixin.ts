import { getConf, resolveConf, setConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util/mstUtils'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { reaction } from 'mobx'

import type { HeightMode } from './heightMode.ts'
import type { HeightModeConfigModel } from './heightModeConfigSchemaFields.ts'
import type { RegionHost } from './regionHost.ts'
import type { ResolvableDisplay } from '@jbrowse/core/configuration'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { IReactionDisposer } from 'mobx'

/**
 * The whole of what `HeightModeMixin` needs a composing display to be. It keeps
 * `ResolvableDisplay` because the promotable `heightMode` read goes through the
 * cascade, which keys its session-wide tier on `type`; what changed is the
 * `configuration`, narrowed from `AnyConfigurationModel` to this mixin's own
 * field table so the four slot names below are checked again.
 */
export type HeightModeHost = ResolvableDisplay<HeightModeConfigModel>

// The mixin's own `self` is the empty model it declares, so it can't see the
// props the concrete display supplies; every display composing this is a
// BaseDisplay, so they are really there. The mixin took a
// `TConf extends ResolvableDisplay` type parameter for this, but no caller ever
// passed one — it only ever resolved to its own default.
const confNode = (self: object) => self as HeightModeHost

// The `TrackHeightMixin` members this one drives. Composed before it by every
// user (the `height` and `resizeHeight` overrides below depend on that order),
// so they are really there — this is again about what the *mixin* can see.
const heightHost = (self: object) =>
  self as {
    setHeight: (height: number) => number
    setScrollTop: (scrollTop: number) => void
    setHeightMode: (mode: HeightMode) => void
  }

/**
 * #stateModel HeightModeMixin
 * #category display
 * #crossCuttingMixin Track-height strategy; the one row that must compose **after** `TrackHeightMixin()`, whose `height` and `resizeHeight` it overrides. `growTargetHeight` (default = the raw slot). Brings `heightMode`/`autoHeight`/`fitHeightToDisplay`, `grownHeight`, the reactive `height` override, `setHeightMode`, and the grow-aware `resizeHeight`, and the grow-exit bake reaction that writes the grown height into the slot when the mode leaves grow
 *
 * The whole track-height strategy every display with a promotable `heightMode`
 * config slot shares (the canvas feature display, the alignments display), so the
 * fixed/grow/fit vocabulary is identical by construction rather than by two call
 * sites that happen to agree. What differs between the two — canvas fits a
 * feature stack, alignments a grouped pileup — is exactly one getter,
 * `growTargetHeight`.
 *
 * `heightMode` is the single source of truth (resolved through the promotable
 * session-default cascade); `autoHeight`/`fitHeightToDisplay` are plain-flag
 * conveniences derived from it. `fitTargetHeight` is the raw drag-resizable
 * `height` slot, read by the fit/grow layout machinery INSTEAD of the reactive
 * `height` getter: in grow mode `height` returns the content-derived grown height,
 * so routing the layout through it would make that height depend on itself (a MobX
 * computed cycle). In fixed/fit mode `fitTargetHeight` equals `height`.
 *
 * **Grow mode lives here in full.** A display supplies one getter —
 * `growTargetHeight`, the height its laid-out content wants — and gets
 * `grownHeight` (that, capped at `growMaxHeight`), the reactive `height`
 * override, the drag-resize that leaves grow first, and the `setHeightMode`
 * base. Both users previously carried character-identical copies of the last
 * three, comments included.
 *
 * Must be composed **after** `TrackHeightMixin`: it overrides that mixin's
 * `height` getter and `resizeHeight` action, and `types.compose` resolves a
 * collision to the later argument. `no-restricted-syntax` fails the wrong order
 * written in one `types.compose` and says what it costs.
 */
export default function HeightModeMixin() {
  return types
    .model({})
    .views(self => ({
      /**
       * #getter
       * The resolved track-height strategy (`fixed`/`grow`/`fit`). Promotable
       * sentinel slot: resolveConf walks the customized-track -> session-default
       * -> `fixed` cascade and never returns the `inherit` sentinel.
       */
      get heightMode(): HeightMode {
        return resolveConf(confNode(self), 'heightMode')
      },
      /**
       * #getter
       * The drag-resizable track height as stored in the config slot — the fit
       * target the fit/grow layout scales or packs content into. Read there
       * instead of the reactive `height` getter to break the grow-mode cycle
       * (`height`->grownHeight->layout->height). Equals `height` in fixed/fit.
       */
      get fitTargetHeight(): number {
        return getConf(confNode(self), 'height')
      },
      /**
       * #getter
       * Ceiling `grow` mode sizes the track to, in px (content past it scrolls).
       * Lives here rather than as a constant so a track whose whole point is a
       * deep pileup can raise it; both displays that own a `grownHeight` read
       * this, so the two can't diverge.
       */
      get growMaxHeight(): number {
        return getConf(confNode(self), 'growMaxHeight')
      },
    }))
    .views(self => ({
      /**
       * #getter
       * `grow` mode as a boolean, derived from the unified `heightMode` slot.
       */
      get autoHeight(): boolean {
        return self.heightMode === 'grow'
      },
      /**
       * #getter
       * `fit` mode as a boolean, derived from the unified `heightMode` slot.
       */
      get fitHeightToDisplay(): boolean {
        return self.heightMode === 'fit'
      },
      /**
       * #getter
       * Overridable hook: the height this display's laid-out content wants, in
       * px, before the `growMaxHeight` cap. Canvas answers with its settled
       * feature stack, alignments with its stacked-sections height. The default
       * is the raw slot, so a display that composes this without answering just
       * behaves as if it were fixed.
       *
       * **It must not read the reactive `height` getter**, directly or through a
       * layout that does — in grow mode `height` returns `grownHeight`, so that
       * is a MobX computed cycle. Read `fitTargetHeight`/`growMaxHeight`
       * instead; both users do, and say so.
       */
      get growTargetHeight(): number {
        return self.fitTargetHeight
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Target track height for `grow`: what the content wants, capped so a
       * deep stack doesn't grow the track to thousands of px (the remainder
       * scrolls). What `installGrowExitBake` bakes into the slot on exit.
       */
      get grownHeight(): number {
        return Math.min(self.growTargetHeight, self.growMaxHeight)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * In grow mode the track height follows the laid-out content reactively —
       * no autorun writes the height config slot, so a settled relayout never
       * churns the persisted session nor bakes a momentary height. Fixed/fit
       * read the slot (fit shrinks content to fill it).
       *
       * Guarded on `view.initialized`: `growTargetHeight` transitively reads
       * view-geometry getters that throw before the view is measured, and unlike
       * an autorun (whose MobX error boundary would swallow the pre-init throw)
       * a getter propagates it into render/hydration. Overrides
       * `TrackHeightMixin.height`.
       */
      get height(): number {
        const view = getContainingView(self) as RegionHost
        return self.autoHeight && view.initialized
          ? self.grownHeight
          : self.fitTargetHeight
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Set the track-height strategy by writing the unified `heightMode` slot;
       * the modes are mutually exclusive by construction. Leaving grow bakes the
       * grown height into the `height` slot in the same action, so the switch is
       * atomic: `installGrowExitBake` also covers this exit, but it is a
       * reaction, and an observer scheduled ahead of it would catch the new mode
       * against the stale slot — a track grown to 800px fitting one frame into
       * the 100px the slot still held. The reaction sees the slot move with the
       * mode and skips, the same guard that protects a drag-resize exit.
       * Entering a non-`fixed` mode drops a leftover scroll offset that the
       * reconfigured height contradicts — neither fit nor grow generally
       * scrolls, and a sticky canvas left at an out-of-range offset paints
       * clipped or blank with no DOM scroll event to resync it. Displays with
       * more transient state to reset super-capture this.
       */
      setHeightMode(mode: HeightMode) {
        // `grownHeight` read bare, exactly as `resizeHeight` below reads it: a
        // mode switch is a user gesture, so the view is measured by the time it
        // can fire (the reaction's exits are the ones that need the init guard).
        if (self.autoHeight && mode !== 'grow') {
          heightHost(self).setHeight(self.grownHeight)
        }
        setConf(confNode(self), 'heightMode', mode)
        if (mode !== 'fixed') {
          heightHost(self).setScrollTop(0)
        }
      },
      /**
       * #action
       * Drag-resize. A manual drag means the user wants a fixed height, so leave
       * grow first — otherwise the reactive `height` getter re-derives
       * `grownHeight` on the next relayout and the drag appears to do nothing.
       * The displayed (grown) height is read *before* the flip and written as
       * `displayed + distance`, which is also why `installGrowExitBake` skips
       * when the slot moved during the exit: re-baking would clobber this delta.
       * Overrides `TrackHeightMixin.resizeHeight`.
       */
      resizeHeight(distance: number) {
        const displayed = self.autoHeight
          ? self.grownHeight
          : self.fitTargetHeight
        if (self.autoHeight) {
          heightHost(self).setHeightMode('fixed')
        }
        return heightHost(self).setHeight(displayed + distance) - displayed
      },
    }))
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          installGrowExitBake(
            self as typeof self & { setHeight: (height: number) => number },
          ),
        )
      },
    }))
}

/**
 * Leaving grow mode: bake the height the user was seeing into the `height` slot
 * so fixed/fit start from it rather than snapping to the stale slot value (grow
 * computes `height` reactively and never writes the slot). A reaction as well as
 * the call inside `setHeightMode` because the resolved `heightMode` also flips
 * without any imperative action — resetting a track customized to grow, or changing the
 * session-wide default out from under grow-following tracks that inherit it (the
 * promotable cascade) — and every such exit must bake. Installed from the
 * mixin's own `afterAttach`, which the fork chains under the display's.
 *
 * The captured height is `prev.grown`, computed in the tracked expression while
 * still in grow mode: by the time the effect runs the mode has flipped and
 * `grownHeight` may already reflect the new layout, so reading it there would
 * bake the wrong value. Guarded on `view.initialized` (grownHeight transitively
 * reads view geometry that throws pre-init). No loop: `setHeight` writes only the
 * `height` slot, which the expression ignores once `autoHeight` is false.
 *
 * Skip the bake when the `height` slot itself was written during the exit (`slot`
 * changed alongside `mode`): that is an imperative exit that already settled the
 * slot — a drag-resize leaving grow (`resizeHeight` writes `grownHeight +
 * distance` in the same action), or `setHeightMode`'s own synchronous bake — and
 * re-baking `prev.grown` would clobber a drag delta. Cascade exits leave the
 * slot untouched, so they still bake the displayed height here.
 */
export function installGrowExitBake(
  self: IStateTreeNode & {
    heightMode: HeightMode
    autoHeight: boolean
    grownHeight: number
    fitTargetHeight: number
    setHeight: (height: number) => number
  },
): IReactionDisposer {
  const view = () => getContainingView(self) as RegionHost
  return reaction(
    () => ({
      mode: self.heightMode,
      grown:
        self.autoHeight && view().initialized ? self.grownHeight : undefined,
      slot: self.fitTargetHeight,
    }),
    (curr, prev) => {
      if (
        prev.mode === 'grow' &&
        curr.mode !== 'grow' &&
        prev.grown !== undefined &&
        curr.slot === prev.slot
      ) {
        self.setHeight(prev.grown)
      }
    },
    { name: 'GrowExitBake' },
  )
}
