import { addDisposer, types } from 'mobx-state-tree'
import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, max } from '@jbrowse/core/util'

import { LinearGenomeViewModel } from '../../LinearGenomeView'
import { autorun } from 'mobx'

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
      firstRenderHeight: 0,
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
       * returns the value of the track height setting from the view model
       */
      get trackHeightSetting() {
        const { trackHeightSetting } = getContainingView(
          self,
        ) as LinearGenomeViewModel

        return trackHeightSetting
      },
      /**
       * #getter
       * the max height between the rendered blocks and the configured height
       */
      get maxBlockHeight() {
        // @ts-expect-error
        const confHeight = getConf(self, 'height') as number
        // @ts-expect-error
        return max(self.blockHeights, confHeight)
      },
      /**
       * #getter
       * returns the height value as it corresponds to the setting
       */
      get layoutMaxHeight() {
        // @ts-expect-error
        const confHeight = getConf(self, 'height') as number
        return this.trackHeightSetting === 'on'
          ? this.maxBlockHeight
          : this.trackHeightSetting === 'first_render'
            ? max([self.firstRenderHeight], confHeight)
            : confHeight
      },
      /**
       * #getter
       * returns the height of the track as a combination of the config and the settings
       */
      get height() {
        return self.heightPreConfig ?? this.layoutMaxHeight
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
    .actions(self => ({
      afterAttach() {
        addDisposer(
          self,
          autorun(() => {
            const ready =
              // @ts-expect-error
              self.allBlocksRendered && self.firstRenderHeight === 0
            if (self.trackHeightSetting === 'first_render' && ready) {
              self.setFirstRenderHeight(self.maxBlockHeight)
            }
          }),
        )
      },
    }))
}
