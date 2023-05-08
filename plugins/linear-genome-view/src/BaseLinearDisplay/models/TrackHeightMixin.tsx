import { getConf } from '@jbrowse/core/configuration'
import { types } from 'mobx-state-tree'

const minDisplayHeight = 20

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

    .views(self => ({
      get height() {
        // @ts-expect-error
        return self.heightPreConfig ?? (getConf(self, 'height') as number)
      },
    }))
    .actions(self => ({
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
