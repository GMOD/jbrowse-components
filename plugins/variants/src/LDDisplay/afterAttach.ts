import { getContainingView } from '@jbrowse/core/util'
import { addDisposer } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface LDModel {
  isMinimized: boolean
  showLDTriangle: boolean
  regionTooLarge: boolean
  rpcProps(): Record<string, unknown>
  userByteSizeLimit: number | undefined
  performLDFetch(): void
}

export function doAfterAttach(self: LDModel) {
  addDisposer(
    self,
    autorun(
      () => {
        if (self.isMinimized) {
          return
        }
        const view = getContainingView(self) as LGV
        if (!view.initialized) {
          return
        }
        if (
          !self.showLDTriangle ||
          self.regionTooLarge ||
          !view.dynamicBlocks.contentBlocks.length
        ) {
          return
        }
        // rpcProps IS the full RPC payload; any field change refires the
        // autorun. Viewport reads above already retrigger on pan/zoom.
        void self.rpcProps()
        void self.userByteSizeLimit
        self.performLDFetch()
      },
      {
        delay: 500,
        name: 'LDDisplayRender',
      },
    ),
  )
}
