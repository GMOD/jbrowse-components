import { getConf } from '@jbrowse/core/configuration'
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
 * auto-fit mode declare `height` as a nullable (`maybe`) number slot (default
 * `undefined`) and override the `height` getter to fall back to their computed
 * content height when unset.
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
      setHeight(displayHeight: number) {
        const height = Math.max(displayHeight, MIN_DISPLAY_HEIGHT)
        ;(self as unknown as TConf).configuration.setSlot('height', height)
        return height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = Math.max(oldHeight + distance, MIN_DISPLAY_HEIGHT)
        ;(self as unknown as TConf).configuration.setSlot('height', newHeight)
        return newHeight - oldHeight
      },
    }))
}
