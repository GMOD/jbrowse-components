import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { migrateTrackHeightSnapshot } from './migration.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

export const MIN_DISPLAY_HEIGHT = 20

/**
 * #stateModel TrackHeightMixin
 * #category display
 */
export default function TrackHeightMixin<
  TConf extends { configuration: AnyConfigurationModel } = {
    configuration: AnyConfigurationModel
  },
>() {
  return types
    .model({
      /**
       * #property
       * the explicitly-set display height (e.g. from a drag-resize); the
       * `height` getter resolves this over the config `height` slot. Named with
       * the `Override` suffix to match the override convention used elsewhere
       * (`configOverrides`, `setOverride`); the bare `height` name belongs to
       * the resolving getter.
       */
      heightOverride: types.maybe(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= MIN_DISPLAY_HEIGHT,
        ),
      ),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      scrollTop: 0,
    }))
    .views(self => ({
      get height() {
        return (
          self.heightOverride ??
          (getConf(self as unknown as TConf, 'height') as number)
        )
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
        self.heightOverride = Math.max(displayHeight, MIN_DISPLAY_HEIGHT)
        return self.height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        self.heightOverride = Math.max(self.height + distance, MIN_DISPLAY_HEIGHT)
        return self.height - oldHeight
      },
    }))
    .preProcessSnapshot((snap: Record<string, unknown> | undefined) =>
      migrateTrackHeightSnapshot(snap),
    )
}
