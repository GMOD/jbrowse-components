import { getConf } from '@jbrowse/core/configuration'
import {
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import {
  AUTO_FORCE_LOAD_BP,
  getDisplayStr,
} from '@jbrowse/plugin-linear-genome-view'
import { autorun, untracked } from 'mobx'

import type { SharedLDModel } from './shared.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function doAfterAttach(self: SharedLDModel) {
  async function fetchByteEstimate(
    regions: {
      refName: string
      start: number
      end: number
      assemblyName: string
    }[],
  ) {
    const session = getSession(self)
    const sessionId = getRpcSessionId(self)
    return session.rpcManager.call(sessionId, 'CoreGetFeatureDensityStats', {
      regions,
      adapterConfig: self.adapterConfig,
    })
  }

  let fetchGeneration = 0

  const performRender = async () => {
    if (self.isMinimized) {
      return
    }
    const view = getContainingView(self) as LGV
    const { bpPerPx, dynamicBlocks } = view
    const regions = dynamicBlocks.contentBlocks

    if (!regions.length) {
      return
    }

    const { adapterConfig } = self

    try {
      const gen = ++fetchGeneration
      const session = getSession(self)
      const { rpcManager } = session
      const rpcSessionId = getRpcSessionId(self)

      const previousToken = untracked(() => self.renderingStopToken)
      if (previousToken) {
        stopStopToken(previousToken)
      }

      const stopToken = createStopToken()
      self.setRenderingStopToken(stopToken)

      const stats = await fetchByteEstimate([...regions])
      if (fetchGeneration !== gen) {
        return
      }
      self.setFeatureDensityStats(stats)
      if (view.visibleBp >= AUTO_FORCE_LOAD_BP) {
        const fetchSizeLimit =
          stats.fetchSizeLimit ?? getConf(self, 'fetchSizeLimit')
        const limit = self.userByteSizeLimit || fetchSizeLimit
        if (stats.bytes && stats.bytes > limit) {
          self.setRegionTooLarge(
            true,
            `Requested too much data (${getDisplayStr(stats.bytes)})`,
          )
          return
        }
      }
      self.setRegionTooLarge(false)

      const result = await rpcManager.call(
        rpcSessionId,
        'RenderLDData',
        {
          adapterConfig,
          regions: [...regions],
          bpPerPx,
          ...self.rpcProps,
          stopToken,
        },
        {
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
        },
      )

      self.setRpcData(result)
      self.setLastDrawnOffsetPx(view.offsetPx)
      self.setLastDrawnBpPerPx(view.bpPerPx)
    } catch (error) {
      if (!isAbortException(error)) {
        console.error(error)
        if (isAlive(self)) {
          self.setError(error)
        }
      }
    } finally {
      if (isAlive(self)) {
        self.setRenderingStopToken(undefined)
        self.setStatusMessage(undefined)
      }
    }
  }

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
        const { dynamicBlocks } = view
        const regions = dynamicBlocks.contentBlocks

        // Single tracked read — rpcProps IS the full RPC payload, so every
        // field it reads participates in this autorun's dependency graph.
        // Adding an RPC-affecting field to rpcProps auto-wires refetch.
        void self.rpcProps
        void self.userByteSizeLimit

        if (
          !self.showLDTriangle ||
          self.regionTooLarge ||
          untracked(() => self.error) ||
          !regions.length
        ) {
          return
        }

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        performRender()
      },
      {
        delay: 500,
        name: 'LDDisplayRender',
      },
    ),
  )
}
