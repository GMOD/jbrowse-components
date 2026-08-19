import { getConf, setConf } from '@jbrowse/core/configuration'
import { clamp } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { MIN_DISPLAY_HEIGHT } from './const.ts'

import type { BaseLinearDisplayConfigModel } from './configSchema.ts'

// What this mixin needs a composing display to be: `height` is
// `baseLinearDisplayConfigSchema`'s slot, so the base schema is the whole
// contract. Not a `TConf extends { configuration: AnyConfigurationModel }` type
// parameter — a generic body is checked against the constraint, so however
// narrow the default is, `getConf(self, 'heigth')` still compiles.
export interface TrackHeightHost {
  configuration: BaseLinearDisplayConfigModel
}

const confNode = (self: object) => self as TrackHeightHost

/**
 * #stateModel TrackHeightMixin
 * #category display
 * #crossCuttingMixin Internal vertical scroll. `scrollableHeight` (default `Infinity` = doesn't scroll). Brings the clamped `setScrollTop` and the autorun that re-clamps when content shrinks
 *
 * The display height is stored directly on the `height` config slot (drag-resize
 * writes it via `setSlot`), so it survives a track being unticked and reticked —
 * the config node outlives the ephemeral display instance. Displays with an
 * auto-fit mode declare `height` as a `maybeNumber` slot (default `undefined`)
 * and override the `height` getter to fall back to their computed content
 * height when unset.
 *
 * It also owns the **internal vertical scroll** every canvas display that
 * scrolls its own content shares: the `scrollTop` volatile, a `setScrollTop`
 * clamped against the overridable `scrollableHeight` hook, and the autorun that
 * re-clamps when the content shrinks. Four displays (alignments, canvas, MAF,
 * multi-sample variants) each carried their own copy of the last two, with four
 * copies of the same "a virtual-scrolled canvas has no overflow container to
 * self-correct" paragraph; a display now opts into all of it by overriding one
 * getter.
 */
export default function TrackHeightMixin() {
  return types
    .model({})
    .volatile(() => ({
      /**
       * #volatile
       */
      scrollTop: 0,
      /**
       * #volatile
       * True for the duration of a height drag, set by the track container's
       * resize handle. A display whose row geometry is a function of the track
       * height restretches every row per animation frame, and can use this to
       * sit an expensive per-frame layer out of the drag (MAF's dense per-base
       * letter overlay is a Canvas2D pass that scales with rows x columns).
       *
       * Lives here rather than per display because the handle that knows the
       * drag has started is the shared one next to `resizeHeight`. Displays
       * with their own handles (MAF's band handles) set it directly.
       */
      resizing: false,
    }))
    .views(self => ({
      get height() {
        return getConf(confNode(self), 'height')
      },
      /**
       * #getter
       * Overridable hook: how far this display's content can scroll past its
       * viewport, in px. `Infinity` (the default) means "this display doesn't
       * scroll internally" — `setScrollTop` then never clamps and the re-clamp
       * autorun below is inert, so a non-scrolling display pays nothing and,
       * crucially, never evaluates a getter that would read view geometry.
       *
       * A display that scrolls a canvas overrides this with `max(0, contentHeight
       * - viewportHeight)`, and gets the clamped setter plus the shrink autorun
       * for free. It is the single "does it scroll, and by how much" answer: the
       * wheel handler (`useVirtualScrollWheel`) and `VerticalScrollbar` read the
       * same getter.
       */
      get scrollableHeight(): number {
        return Number.POSITIVE_INFINITY
      },

      /**
       * #getter
       * Whether this display offers the fixed/grow/fit vocabulary at all, or
       * only the drag-resizable `height` slot above. False here; `HeightModeMixin`
       * overrides it to true, and `types.compose` resolves the collision to the
       * later argument — which is exactly what makes it a usable compose-order
       * probe, the same way `measuresBytesInFetch` is for the canvas size gate.
       *
       * That probe is the point. `HeightModeMixin` also overrides `height` and
       * `resizeHeight`, and composing it FIRST silently hands both back to this
       * mixin: grow mode stops working with no error anywhere, and the two
       * `height` getters agree in fixed mode, so no *value* can tell the orders
       * apart. A flag that differs by construction can. Read back in
       * `HeightModeMixin`'s `afterAttach`.
       */
      get supportsHeightModes(): boolean {
        return false
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Clamped into `[0, scrollableHeight]`, so no caller has to remember the
       * bound. Unbounded for a display that leaves `scrollableHeight` at its
       * `Infinity` default.
       */
      setScrollTop(scrollTop: number) {
        const next = clamp(scrollTop, 0, self.scrollableHeight)
        if (self.scrollTop !== next) {
          self.scrollTop = next
        }
      },
      /**
       * #action
       */
      setResizing(arg: boolean) {
        self.resizing = arg
      },
      /**
       * #action
       */
      setHeight(displayHeight: number) {
        const height = Math.max(displayHeight, MIN_DISPLAY_HEIGHT)
        setConf(confNode(self), 'height', height)
        return height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = Math.max(oldHeight + distance, MIN_DISPLAY_HEIGHT)
        setConf(confNode(self), 'height', newHeight)
        return newHeight - oldHeight
      },
    }))
    .actions(self => ({
      /**
       * #action
       * Grow the track by exactly the content it is currently hiding, so a
       * display scrolled over a taller stack ends up showing all of it. The
       * track's resize handle runs this on a double click.
       *
       * `scrollableHeight` is the whole measurement — it is already every
       * scrolling display's answer to "how much is off the bottom", so no
       * display has to supply a second one. A display that doesn't scroll
       * internally leaves it at `Infinity` and gets a no-op, as does one
       * already showing everything (0).
       *
       * Routed through `resizeHeight` rather than `setHeight` so grow mode's
       * override still gets to leave grow first; going straight to the slot
       * would let the reactive height re-derive `grownHeight` and the double
       * click would appear to do nothing.
       */
      expandToContentHeight() {
        const hidden = self.scrollableHeight
        return Number.isFinite(hidden) && hidden > 0
          ? self.resizeHeight(hidden)
          : 0
      },
      afterAttach() {
        // Keep scrollTop inside the content by construction. Any geometry change
        // — a shorter track, a smaller row height, a group collapse, a filter, a
        // drag-resize — can drop the scroll extent below the current offset, and
        // a virtual-scrolled canvas has no overflow container to self-correct.
        // Enforcing the bound reactively here is what lets every
        // geometry-changing action stay ignorant of it.
        //
        // Deliberately reads nothing but `scrollableHeight`: for a display that
        // leaves the hook at `Infinity` the body registers no dependency at all,
        // so this stays inert (and view-free) on the ten displays that don't
        // scroll. The `isFinite` test is what makes that true — `Infinity` is
        // never exceeded, but the comparison alone would still read `scrollTop`.
        addDisposer(
          self,
          autorun(
            () => {
              const max = self.scrollableHeight
              if (Number.isFinite(max) && self.scrollTop > max) {
                self.setScrollTop(max)
              }
            },
            { name: 'TrackHeightClampScroll' },
          ),
        )
      },
    }))
}
