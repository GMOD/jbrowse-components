import { getConf } from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const minDisplayHeight = 20

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
          n => n >= minDisplayHeight,
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
        self.heightOverride = Math.max(displayHeight, minDisplayHeight)
        return self.height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        self.heightOverride = Math.max(self.height + distance, minDisplayHeight)
        return self.height - oldHeight
      },
    }))
    .preProcessSnapshot(snap => {
      // Back-compat: the field was `heightPreConfig` and older snapshots also
      // stored a bare `height`. Both now normalize to `heightOverride`. This is
      // composed into every TrackHeightMixin display, so it covers the displays
      // that don't have their own height migration.
      const s = snap as
        | (typeof snap & { height?: number; heightPreConfig?: number })
        | undefined
      if (
        s &&
        s.heightOverride === undefined &&
        (s.height !== undefined || s.heightPreConfig !== undefined)
      ) {
        const { height, heightPreConfig, ...rest } = s
        return { ...rest, heightOverride: height ?? heightPreConfig }
      }
      return snap
    })
}
