import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingTrack,
  getContainingView,
  measureText,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'

/**
 * Shared MST mixin for both LinearWiggleDisplay and MultiLinearWiggleDisplay.
 * Owns the resolution/displayCrossHatches fields and the scalebarOverlapLeft view.
 */
export function WiggleCommonMixin() {
  return types
    .model({
      resolution: types.optional(types.number, 1),
      displayCrossHatches: types.optional(types.boolean, false),
    })
    .views(self => ({
      get scalebarOverlapLeft() {
        const view = getContainingView(self) as { trackLabelsSetting?: string }
        if (view.trackLabelsSetting === 'overlapping') {
          const track = getContainingTrack(self)
          return measureText(getConf(track, 'name'), 12.8) + 100
        }
        return 0
      },
    }))
    .actions(self => ({
      toggleCrossHatches() {
        self.displayCrossHatches = !self.displayCrossHatches
      },
      setResolution(res: number) {
        self.resolution = res
      },
    }))
}
