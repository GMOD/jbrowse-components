import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import calculateDynamicBlocks from '@jbrowse/core/util/calculateDynamicBlocks'
import { observable } from 'mobx'
import { getParent } from 'mobx-state-tree'

import type { Instance } from 'mobx-state-tree'

/**
 * #stateModel Dotplot1DView
 * ref https://mobx-state-tree.js.org/concepts/volatiles on volatile state used here
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const Dotplot1DView = Base1DView.extend(self => {
  const scaleFactor = observable.box(1)
  return {
    views: {
      /**
       * #getter
       * this uses padding=false and elision=false
       */
      get dynamicBlocks() {
        return calculateDynamicBlocks(self, false, false)
      },
      /**
       * #getter
       */

      get scaleFactor() {
        return scaleFactor.get()
      },

      /**
       * #getter
       */
      get maxBpPerPx() {
        return self.totalBp / (self.width * 0.9)
      },

      /**
       * #getter
       */
      get minBpPerPx() {
        return 1 / 50
      },

      /**
       * #getter
       */
      get maxOffset() {
        const leftPadding = 10
        return self.displayedRegionsTotalPx - leftPadding
      },

      /**
       * #getter
       */
      get minOffset() {
        const rightPadding = 30
        return -self.width + rightPadding
      },
    },
    actions: {
      /**
       * #action
       */
      setScaleFactor(n: number) {
        scaleFactor.set(n)
      },

      /**
       * #action
       */
      center() {
        const centerBp = self.totalBp / 2
        const centerPx = centerBp / self.bpPerPx
        self.scrollTo(centerPx - self.width / 2)
      },
    },
  }
})

const DotplotHView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<any>(self).viewWidth
    },
  },
}))

const DotplotVView = Dotplot1DView.extend(self => ({
  views: {
    get width() {
      return getParent<any>(self).viewHeight
    },
  },
}))

export { Dotplot1DView, DotplotHView, DotplotVView }
export type Dotplot1DViewModel = Instance<typeof Dotplot1DView>
