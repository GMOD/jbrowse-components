import { getConf, setConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { MIN_DISPLAY_HEIGHT } from './const.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/**
 * #stateModel TrackHeightMixin
 * #category display
 *
 * The display height is stored directly on the `height` config slot (drag-resize
 * writes it via `setSlot`), so it survives a track being unticked and reticked —
 * the config node outlives the ephemeral display instance. Displays with an
 * auto-fit mode declare `height` as a `maybeNumber` slot (default `undefined`)
 * and override the `height` getter to fall back to their computed content
 * height when unset.
 */
export default function TrackHeightMixin<
  TConf extends { configuration: AnyConfigurationModel } = {
    configuration: AnyConfigurationModel
  },
>() {
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
        return getConf(self as unknown as TConf, 'height') as number
      },
    }))
    .actions(self => ({
      /**
       * #action
       */
      setScrollTop(scrollTop: number) {
        self.scrollTop = scrollTop
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
        setConf(self as unknown as TConf, 'height', height)
        return height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = Math.max(oldHeight + distance, MIN_DISPLAY_HEIGHT)
        setConf(self as unknown as TConf, 'height', newHeight)
        return newHeight - oldHeight
      },
    }))
}
