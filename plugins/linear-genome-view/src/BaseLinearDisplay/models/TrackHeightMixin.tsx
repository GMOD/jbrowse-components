import { addDisposer, types } from 'mobx-state-tree'
import { getConf } from '@jbrowse/core/configuration'
import { getContainingView, getSession, max } from '@jbrowse/core/util'

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
      get adjustTrackLayoutHeightSetting() {
        const { adjustTrackLayoutHeightSetting } = getContainingView(
          self,
        ) as LinearGenomeViewModel

        return adjustTrackLayoutHeightSetting
      },
      /**
       * #getter
       * the max height between the rendered blocks and the configured height
       */
      get maxLayoutBlockHeight() {
        // @ts-expect-error
        const confHeight = getConf(self, 'height') as number
        // @ts-expect-error
        return max(self.layoutBlockHeights, confHeight)
      },
      /**
       * #getter
       * returns the height of the track as a combination of the config and the settings
       */
      get height() {
        // @ts-expect-error
        return self.heightPreConfig ?? (getConf(self, 'height') as number)
      },
    }))
    .actions(self => ({
      setViewTrackLayoutHeightSetting(setting: 'on' | 'off' | 'first_render') {
        const view = getContainingView(self) as LinearGenomeViewModel
        getSession(self).notify(
          'LGV track height setting has changed to use your manually set height.',
          'info',
        )
        view.setAdjustTrackLayoutHeight(setting)
      },
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
        // if the user resizes their height, we want the setting to turn off and maintain their set height
        if (self.adjustTrackLayoutHeightSetting !== 'off') {
          this.setViewTrackLayoutHeightSetting('off')
        }
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
            const setting = self.adjustTrackLayoutHeightSetting
            const ready =
              // @ts-expect-error
              self.allLayoutBlocksRendered && self.firstRenderHeight === 0

            if (setting === 'first_render' && ready) {
              self.setFirstRenderHeight(self.maxLayoutBlockHeight)
              self.setHeight(self.maxLayoutBlockHeight)
            }

            if (setting === 'on') {
              self.setHeight(self.maxLayoutBlockHeight)
            }
          }),
        )
      },
    }))
}
