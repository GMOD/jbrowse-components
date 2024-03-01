import { getConf } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

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
    }))
    .views(self => ({
      get adjustLayout() {
        return (
          // @ts-expect-error
          self.trackHeightSetting === 'on' ||
          // @ts-expect-error
          self.trackHeightSetting === 'first_render'
        )
      },
      get height() {
        return (
          self.heightPreConfig ??
          (this.adjustLayout
            ? // @ts-expect-error
              self.layoutMaxHeight
            : // @ts-expect-error
              (getConf(self, 'height') as number))
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
