import { types } from 'mobx-state-tree'
import { getConf } from '@jbrowse/core/configuration'
import { getContainingView } from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '../../LinearGenomeView'

const minDisplayHeight = 20

/**
 * #stateModel TrackHeightMixin
 * #category display
 */
export default function TrackHeightMixin() {
  return types
    .model({
      /**
       * #property
       */
      heightPreConfig: types.maybe(
        types.refinement(
          'displayHeight',
          types.number,
          n => n >= minDisplayHeight,
        ),
      ),
    })
    .volatile(() => ({
      /**
       * #property
       */
      scrollTop: 0,
      /**
       * #property
       */
      firstRenderHeight: 100,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setFirstRenderHeight(val: number) {
        self.firstRenderHeight = val
        return val
      },
    }))
    .views(self => ({
      /**
       * #getter
       * returns the height value as determined by the trackHeightSetting
       */
      get adjustLayout() {
        const { trackHeightSetting } = getContainingView(
          self,
        ) as LinearGenomeViewModel

        // @ts-expect-error
        const height = self.layoutMaxHeight

        return trackHeightSetting === 'on'
          ? height
          : trackHeightSetting === 'first_render' &&
              self.firstRenderHeight === 100
            ? self.setFirstRenderHeight(height)
            : trackHeightSetting === 'first_render'
              ? self.firstRenderHeight
              : undefined
      },
      get height() {
        return (
          self.heightPreConfig ??
          this.adjustLayout ??
          // @ts-expect-error
          (getConf(self, 'height') as number)
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
        self.heightPreConfig = Math.max(displayHeight, minDisplayHeight)
        return self.height
      },
      /**
       * #action
       */
      resizeHeight(distance: number) {
        const oldHeight = self.height
        const newHeight = this.setHeight(self.height + distance)
        return newHeight - oldHeight
      },
    }))
}
