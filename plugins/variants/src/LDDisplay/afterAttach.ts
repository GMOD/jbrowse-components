import {
  getContainingView,
  getRpcSessionId,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { addDisposer, isAlive } from '@jbrowse/mobx-state-tree'
import { drawCanvasImageData } from '@jbrowse/plugin-linear-genome-view'
import { autorun, untracked } from 'mobx'

import type { SharedLDModel } from './shared.ts'
import type { LDFlatbushItem } from '../LDRenderer/types.ts'
import type { FilterStats, LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  flatbush?: ArrayBufferLike
  items?: LDFlatbushItem[]
  ldData?: {
    snps: LDMatrixResult['snps']
  }
  filterStats?: FilterStats
  recombination?: {
    values: number[]
    positions: number[]
  }
  maxScore?: number
  yScalar?: number
  w?: number
  width: number
  height: number
}

export function doAfterAttach(self: SharedLDModel) {
  const performRender = async () => {
    if (self.isMinimized) {
      return
    }
    // Skip rendering if LD triangle is hidden
    if (!self.showLDTriangle) {
      return
    }
    const view = getContainingView(self) as LGV
    const { bpPerPx, dynamicBlocks } = view
    const regions = dynamicBlocks.contentBlocks

    if (!regions.length) {
      return
    }

    // Don't render when zoomed out too far
    if (bpPerPx > 1000) {
      return
    }

    // Use untracked to prevent these from being tracked by the autorun
    // We explicitly list what should trigger re-rendering above
    const { adapterConfig } = self
    const renderProps = untracked(() => self.renderProps())

    try {
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

      const result = (await rpcManager.call(
        rpcSessionId,
        'CoreRender',
        {
          sessionId: rpcSessionId,
          rendererType: 'LDRenderer',
          regions: [...regions],
          adapterConfig,
          bpPerPx,
          stopToken,
          ...renderProps,
        },
        {
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
        },
      )) as RenderResult

      if (result.imageData) {
        self.setRenderingImageData(result.imageData)
        self.setLastDrawnOffsetPx(view.offsetPx)
        self.setLastDrawnBpPerPx(view.bpPerPx)
      }
      // Store flatbush data for mouseover
      self.setFlatbushData(
        result.flatbush,
        result.items ?? [],
        result.ldData?.snps ?? [],
        result.maxScore ?? 1,
        result.yScalar ?? 1,
        result.w ?? 0,
      )
      // Store filter stats
      self.setFilterStats(result.filterStats)
      // Store recombination data
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
      }
    }
  }

  // Autorun to trigger rendering when parameters change
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
        // access these to trigger autorun on changes
        self.ldMetric
        self.minorAlleleFrequencyFilter
        self.lengthCutoffFilter
        self.hweFilterThreshold
        self.colorScheme
        self.showLDTriangle
        self.fitToHeight
        self.useGenomicPositions
        // When fitToHeight is true, also track ldCanvasHeight so resizing
        // the display triggers a re-render
        if (self.fitToHeight) {
          self.ldCanvasHeight
        }
        // Note: lineZoneHeight, recombinationZoneHeight, and showRecombination
        // are handled by CSS/React, not canvas rendering
        /* eslint-enable @typescript-eslint/no-unused-expressions */

        if (untracked(() => self.error) || !regions.length) {
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

  // Autorun to draw the canvas when imageData changes
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
        drawCanvasImageData(self.ref, self.renderingImageData)
      },
      {
        delay: 1000,
        name: 'LDDisplayCanvas',
      },
    ),
  )
}
