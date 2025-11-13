import { getContainingView, getSession } from '@jbrowse/core/util'

import { createAutorun } from '../util'
import { fetchChains } from '../shared/fetchChains'

import type { LinearReadCloudDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

export function doAfterAttachRPC(self: LinearReadCloudDisplayModel) {
  // Keep the existing autorun for fetching chains
  createAutorun(
    self,
    async () => {
      await fetchChains(self)
    },
    { delay: 1000 },
  )

  // Autorun to trigger RPC rendering when chainData or view changes
  createAutorun(
    self,
    async () => {
      const view = getContainingView(self) as LGV
      const { chainData } = self

      if (!chainData) {
        return
      }

      // Don't render if already rendering
      if (self.isRendering) {
        return
      }

      try {
        self.setIsRendering(true)

        const session = getSession(self)
        const { rpcManager } = session
        const assemblyName = view.assemblyNames[0]
        if (!assemblyName) {
          return
        }

        // Get current view dimensions and settings
        const width = view.dynamicBlocks.totalWidthPx
        const height = self.height
        const { bpPerPx, offsetPx } = view
        const regions = view.dynamicBlocks.contentBlocks

        // Call RPC method
        const result = (await rpcManager.call(
          self.id,
          'RenderLinearReadCloudDisplay',
          {
            regions,
            chainData,
            featureHeight: self.featureHeightSetting,
            noSpacing: self.noSpacing ?? false,
            drawCloud: self.drawCloud,
            colorBy: self.colorBy,
            drawSingletons: self.drawSingletons,
            drawProperPairs: self.drawProperPairs,
            flipStrandLongReadChains: self.flipStrandLongReadChains,
            trackMaxHeight: self.trackMaxHeight,
            width,
            height,
            bpPerPx,
            offsetPx,
            assemblyName,
            highResolutionScaling: 2,
          },
        )) as {
          imageData?: ImageBitmap
          layoutHeight?: number
        }

        // Store the result
        if (result.imageData) {
          self.setRenderingImageData(result.imageData)
          if (result.layoutHeight !== undefined) {
            self.setLayoutHeight(result.layoutHeight)
          }
        }

        self.setLastDrawnOffsetPx(view.offsetPx)
        self.setLastDrawnBpPerPx(view.bpPerPx)
      } catch (error) {
        console.error('RPC rendering error:', error)
        self.setError(error)
      } finally {
        self.setIsRendering(false)
      }
    },
    { delay: 1000 },
  )

  // Autorun to draw the imageData to canvas when available
  createAutorun(self, async () => {
    const canvas = self.ref
    const { renderingImageData } = self

    if (!canvas || !renderingImageData) {
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    const height = self.layoutHeight || self.height
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(renderingImageData, 0, 0)
  })
}
