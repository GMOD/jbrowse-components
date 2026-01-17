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

import type { LDDisplayModel } from './model.ts'
import type { LDFlatbushItem } from '../LDRenderer/types.ts'
import type { LDMatrixResult } from '../VariantRPC/getLDMatrix.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  flatbush?: ArrayBufferLike
  items?: LDFlatbushItem[]
  ldData?: {
    snps: LDMatrixResult['snps']
  }
  maxScore?: number
  yScalar?: number
  width: number
  height: number
}

export function doAfterAttach(self: LDDisplayModel) {
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

    // Don't render when zoomed out too far
    if (bpPerPx > 1000) {
      return
    }

    const { adapterConfig } = self
    const renderProps = self.renderProps()

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
      }
      // Store flatbush data for mouseover
      self.setFlatbushData(
        result.flatbush,
        result.items ?? [],
        result.ldData?.snps ?? [],
        result.maxScore ?? 1,
        result.yScalar ?? 1,
      )
    } catch (error) {
      if (!isAbortException(error)) {
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
        self.colorScheme
        self.height
        // Note: lineZoneHeight not included - SVG lines component handles it reactively
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
        delay: 100,
        name: 'LDDisplayCanvas',
      },
    ),
  )
}
