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
  resolution: number
  availableResolutions: number[] | undefined
  rpcProps(): Record<string, unknown>
  adapterConfig: Record<string, unknown>
  setAvailableNormalizations(norms: string[]): void
  setAvailableResolutions(resolutions: number[]): void
  setResolution(res: number): void
  performHicFetch(): void
}

export function doAfterAttach(self: HicModel) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  ;(async () => {
    try {
      const { rpcManager } = getSession(self)
      const rpcSessionId = getRpcSessionId(self)
      const { norms, resolutions } = (await rpcManager.call(
        rpcSessionId,
        'CoreGetInfo',
        {
          adapterConfig: self.adapterConfig,
        },
      )) as { norms?: string[]; resolutions?: number[] }
      if (isAlive(self)) {
        if (norms) {
          self.setAvailableNormalizations(norms)
        }
        if (resolutions) {
          self.setAvailableResolutions(resolutions)
          if (!resolutions.includes(self.resolution)) {
            const view = getContainingView(self) as LGV
            const bpPerPx = Math.max(1, view.bpPerPx)
            const resolutionRequest = bpPerPx

            let chosenRes = resolutions[resolutions.length - 1]!
            for (let i = resolutions.length - 1; i >= 0; i -= 1) {
              const r = resolutions[i]!
              if (r <= 2 * resolutionRequest) {
                chosenRes = r
              }
            }
            console.warn('[HiC] Setting initial resolution based on zoom: bpPerPx=', bpPerPx, '-> resolution=', chosenRes)
            self.setResolution(chosenRes)
          }
        }
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
        if (!self.availableResolutions?.includes(self.resolution)) {
          console.warn('[HiC] Skipping fetch: resolution', self.resolution, 'not in availableResolutions', self.availableResolutions)
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
