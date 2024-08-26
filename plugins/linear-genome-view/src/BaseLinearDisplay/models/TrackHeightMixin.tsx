import { addDisposer, types } from 'mobx-state-tree'
import { getConf } from '@jbrowse/core/configuration'
import { getSession, max } from '@jbrowse/core/util'
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
      heightPreConfig: types.number,
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      scrollTop: 0,
    }))
    .views(self => ({
      /**
       * #getter
       * returns the value of the track height setting from the view model
       */
      get adjustTrackLayoutHeightSetting() {
        // @ts-ignore
        const { adjustTrackLayoutHeight } = self

        return adjustTrackLayoutHeight
      },
      /**
       * #getter
       * the max height between the rendered blocks and the configured height
       */
      get maxLayoutBlockHeight() {
        // @ts-expect-error
        const confHeight = getConf(self, 'height') as number
        // @ts-expect-error
        return max(self.currentLayoutBlockHeights, confHeight)
      },
      /**
       * #getter
       * returns the height of the track as a combination of the config and the
       * settings
       */
      get height() {
        // @ts-expect-error
        return self.heightPreConfig ?? (getConf(self, 'height') as number)
      },
    }))
    .actions(self => ({
      notifyStaticSettingChange() {
        getSession(self).notify(
          'LGV track height setting has changed to Static to use your manually set height.',
          'info',
        )
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
        // if the user resizes their height, we want the setting to turn off
        // and maintain their set height
        if (self.adjustTrackLayoutHeightSetting !== 'static') {
          // @ts-ignore
          self.setAdjustTrackLayoutHeightSetting('static')
          this.notifyStaticSettingChange()
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
            // @ts-expect-error
            if (self.allLayoutBlocksRendered) {
              switch (self.adjustTrackLayoutHeightSetting) {
                case 'dynamic':
                  self.setHeight(self.maxLayoutBlockHeight)
                  break
                default:
                  break
              }
            }
          }),
        )
      },
    }))
}
