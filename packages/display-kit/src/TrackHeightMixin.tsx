import { getConf, setConf } from '@jbrowse/core/configuration'
import { clamp, getContainingTrack } from '@jbrowse/core/util'
import { addDisposer, types } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import { MIN_DISPLAY_HEIGHT } from './const.ts'

import type { TrackHeightConfigModel } from './trackHeightConfigSchemaFields.ts'

// What this mixin needs a composing display to be: the one slot it reads and
// writes, from the table that declares it. Not a
// `TConf extends { configuration: AnyConfigurationModel }` type parameter — a
// generic body is checked against the constraint, so however narrow the default
// is, `getConf(self, 'heigth')` still compiles.
export interface TrackHeightHost {
  configuration: TrackHeightConfigModel
}

const confNode = (self: object) => self as TrackHeightHost

const SUBPIXEL_OVERFLOW = 0.5

/**
 * #stateModel TrackHeightMixin
 * #category display
 * #crossCuttingMixin Internal vertical scroll. `scrollContentHeight` and `scrollViewportHeight` (both default 0 = doesn't scroll). Brings the derived `scrollableHeight`, the clamped `setScrollTop` and the autorun that re-clamps when content shrinks
 *
 * The display height lives on the `height` config slot, so it survives a track
 * being unticked and reticked. Displays with an auto-fit mode override the
 * `height` getter.
 *
 * It also owns the **internal vertical scroll** of every display that paints a
 * fixed canvas at `-scrollTop`: a display overrides the two height hooks, and
 * passes itself to `ScrollChrome` and the wheel hooks.
 */
export default function TrackHeightMixin() {
  return types
    .model({})
    .volatile(() => ({
      /**
       * #volatile
       */
      scrollTop: 0,
    }))
    .views(self => ({
      get height() {
        return getConf(confNode(self), 'height')
      },
      /**
       * #getter
       * True for the duration of a height drag on this track, whichever handle
       * is running it. A display whose row geometry is a function of the track
       * height restretches every row per animation frame, and can use this to
       * sit an expensive per-frame layer out of the drag (MAF's dense per-base
       * letter overlay is a Canvas2D pass that scales with rows x columns).
       *
       * The flag itself is the track's (`BaseTrackModel`), so the view brackets
       * a drag without needing the active display to have opted into this
       * mixin. Reading it here is what makes `self.resizing` available to a
       * display that did.
       */
      get resizing() {
        return getContainingTrack(self).resizing
      },
      /**
       * #getter
       * Overridable hook: the height of the content that scrolls, in px.
       */
      get scrollContentHeight(): number {
        return 0
      },
      /**
       * #getter
       * Overridable hook: the height of the window it scrolls behind, in px.
       */
      get scrollViewportHeight(): number {
        return 0
      },
    }))
    .views(self => ({
      /**
       * #getter
       * How far the content scrolls. A sub-pixel overflow is 0: a fit mode that
       * divides the viewport across n rows multiplies back to a few ULPs over
       * it, and an extent of 1e-14px still draws a scrollbar and holds the
       * wheel away from the page.
       */
      get scrollableHeight(): number {
        const overflow = self.scrollContentHeight - self.scrollViewportHeight
        return overflow > SUBPIXEL_OVERFLOW ? overflow : 0
      },
    }))
    .actions(self => ({
      /**
       * #action
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
       * Grow the track by the content it is hiding, for the resize handle's
       * double click. Goes through `resizeHeight` so grow mode's override
       * leaves grow first.
       */
      expandToContentHeight() {
        const hidden = self.scrollableHeight
        return hidden > 0 ? self.resizeHeight(hidden) : 0
      },
      afterAttach() {
        // No overflow container self-corrects a virtual scroll, so whatever
        // shrinks the extent below the offset is caught here.
        addDisposer(
          self,
          autorun(
            () => {
              const max = self.scrollableHeight
              if (self.scrollTop > max) {
                self.setScrollTop(max)
              }
            },
            { name: 'TrackHeightClampScroll' },
          ),
        )
      },
    }))
}
