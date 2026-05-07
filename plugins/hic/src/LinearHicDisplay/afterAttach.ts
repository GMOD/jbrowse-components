import {
  getContainingView,
  getRpcSessionId,
  getSession,
} from '@jbrowse/core/util'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { autorun } from 'mobx'

import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface HicModel {
  isMinimized: boolean
  rpcProps(): Record<string, unknown>
  adapterConfig: Record<string, unknown>
  setAvailableNormalizations(norms: string[]): void
  performHicFetch(): void
}

export function doAfterAttach(self: HicModel) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    try {
      const { rpcManager } = getSession(self)
      const rpcSessionId = getRpcSessionId(self)
      const { norms } = (await rpcManager.call(rpcSessionId, 'CoreGetInfo', {
        adapterConfig: self.adapterConfig,
      })) as { norms?: string[] }
      if (isAlive(self) && norms) {
        self.setAvailableNormalizations(norms)
      }
    } catch (e) {
      console.error(e)
      if (isAlive(self)) {
        getSession(self).notifyError(`${e}`, e)
      }
    }
  })()

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
        if (!view.dynamicBlocks.contentBlocks.length) {
          return
        }

        // rpcProps IS the full RPC payload; any field change refires the
        // autorun. The viewport read above already retriggers on pan/zoom.
        void self.rpcProps()
        self.performHicFetch()
      },
      {
        delay: 1000,
        name: 'LinearHicDisplayRender',
      },
    ),
  )
}
