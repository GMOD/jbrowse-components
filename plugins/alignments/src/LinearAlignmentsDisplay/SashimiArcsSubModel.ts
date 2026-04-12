import { types } from '@jbrowse/mobx-state-tree'

import type { Instance } from '@jbrowse/mobx-state-tree'

export const SashimiArcsSubModel = types
  .model('SashimiArcsSubModel', {
    showSashimiArcs: true,
    sashimiArcsDown: false,
    sashimiArcsHeight: 40,
  })
  .actions(self => ({
    setShowSashimiArcs(show: boolean) {
      self.showSashimiArcs = show
    },
    setSashimiArcsDown(flag: boolean) {
      self.sashimiArcsDown = flag
    },
    setSashimiArcsHeight(height: number) {
      self.sashimiArcsHeight = height
    },
  }))

export type SashimiArcsSubModelInstance = Instance<typeof SashimiArcsSubModel>
