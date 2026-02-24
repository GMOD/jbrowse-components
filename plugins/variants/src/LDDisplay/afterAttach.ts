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
import type { LDDataResult } from '../RenderLDDataRPC/types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function doAfterAttach(self: SharedLDModel) {
  async function fetchByteEstimate(regions: { refName: string }[]) {
    const session = getSession(self)
    const sessionId = getRpcSessionId(self)
    return (await session.rpcManager.call(
      sessionId,
      'CoreGetFeatureDensityStats',
      {
        sessionId,
        regions,
        adapterConfig: self.adapterConfig,
      },
    )) as { bytes?: number; fetchSizeLimit?: number } | undefined
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
      self.setLoading(true)

      const stats = await fetchByteEstimate([...regions])
      if (fetchGeneration !== gen) {
        return
      }
      self.setFeatureDensityStats(stats ?? undefined)
      if (view.visibleBp >= AUTO_FORCE_LOAD_BP) {
        const fetchSizeLimit =
          stats?.fetchSizeLimit ?? getConf(self, 'fetchSizeLimit')
        const limit = self.userByteSizeLimit || fetchSizeLimit
        if (stats?.bytes && stats.bytes > limit) {
          self.setRegionTooLarge(
            true,
            `Requested too much data (${getDisplayStr(stats.bytes)})`,
          )
          return
        }
      }
      self.setRegionTooLarge(false)

      const result = (await rpcManager.call(
        rpcSessionId,
        'RenderLDData',
        {
          sessionId: rpcSessionId,
          adapterConfig,
          regions: [...regions],
          bpPerPx,
          ldMetric: self.ldMetric,
          minorAlleleFrequencyFilter: self.minorAlleleFrequencyFilter,
          lengthCutoffFilter: self.lengthCutoffFilter,
          hweFilterThreshold: self.hweFilterThreshold,
          callRateFilter: self.callRateFilter,
          jexlFilters: self.jexlFilters,
          signedLD: self.signedLD,
          useGenomicPositions: self.useGenomicPositions,
          fitToHeight: self.fitToHeight,
          displayHeight: self.fitToHeight ? self.ldCanvasHeight : undefined,
          stopToken,
        },
        {
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
        },
      )) as LDDataResult

      self.setRpcData(result)
      self.setLastDrawnOffsetPx(view.offsetPx)
      self.setLastDrawnBpPerPx(view.bpPerPx)
      self.setFlatbushData(
        result.flatbush,
        result.items,
        result.snps,
        result.maxScore,
        result.yScalar,
        result.uniformW,
      )
      self.setFilterStats(result.filterStats)
      self.setRecombination(result.recombination)
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
        self.setLoading(false)
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

        /* eslint-disable @typescript-eslint/no-unused-expressions */
        self.ldMetric
        self.minorAlleleFrequencyFilter
        self.lengthCutoffFilter
        self.hweFilterThreshold
        self.callRateFilter
        self.fitToHeight
        self.useGenomicPositions
        self.signedLD
        self.jexlFilters
        self.userByteSizeLimit
        if (self.fitToHeight) {
          self.ldCanvasHeight
        }
        /* eslint-enable @typescript-eslint/no-unused-expressions */

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
