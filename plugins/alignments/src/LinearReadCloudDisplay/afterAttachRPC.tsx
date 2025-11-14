import { getContainingView, getSession } from '@jbrowse/core/util'
import { untracked } from 'mobx'

import { createAutorun } from '../util'
import { buildFlatbushIndex } from './drawFeatsCommon'

import type { LinearReadCloudDisplayModel } from './model'
import type { FlatbushEntry } from '../shared/flatbushType'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  layoutHeight?: number
  featuresForFlatbush?: FlatbushEntry[]
  offsetPx?: number
}

export function doAfterAttachRPC(self: LinearReadCloudDisplayModel) {
  // Common rendering logic
  const performRender = async (drawCloud: boolean, height: number) => {
    const view = getContainingView(self) as LGV

    // Check if we have the necessary conditions to render
    if (
      !view.initialized ||
      self.error ||
      !self.statsReadyAndRegionNotTooLarge
    ) {
      return
    }

    // Don't render if already rendering (use untracked to avoid triggering autorun)
    if (untracked(() => self.isRendering)) {
      return
    }

    const { bpPerPx, offsetPx } = view
    const {
      featureHeightSetting: featureHeight,
      colorBy,
      filterBy,
      drawSingletons,
      drawProperPairs,
      flipStrandLongReadChains,
      noSpacing,
      trackMaxHeight,
    } = self

    try {
      self.setIsRendering(true)

      const session = getSession(self)
      const { rpcManager } = session
      const assemblyName = view.assemblyNames[0]
      if (!assemblyName) {
        return
      }

      const screenWidth = view.dynamicBlocks.totalWidthPx
      // Adjust canvas width when offsetPx is negative
      // This prevents issues with mismatch rendering when scrolled left
      const width = offsetPx < 0 ? screenWidth + offsetPx : screenWidth
      const regions = view.dynamicBlocks.contentBlocks

      // Call RPC method - it will fetch chainData internally
      const result = (await rpcManager.call(
        self.id,
        'RenderLinearReadCloudDisplay',
        {
          sessionId: session.id,
          regions,
          adapterConfig: self.adapterConfig,
          config: self.configuration,
          theme: session.theme,
          filterBy,
          featureHeight,
          noSpacing: noSpacing ?? false,
          drawCloud,
          colorBy,
          drawSingletons,
          drawProperPairs,
          flipStrandLongReadChains,
          trackMaxHeight,
          width,
          height,
          bpPerPx,
          offsetPx,
          assemblyName,
          highResolutionScaling: 2,
        },
      )) as RenderResult

      // Store the result
      if (result.imageData) {
        self.setRenderingImageData(result.imageData)
        // Only set layout height for stack mode
        if (!drawCloud && result.layoutHeight !== undefined) {
          self.setLayoutHeight(result.layoutHeight)
        }
        if (result.featuresForFlatbush) {
          buildFlatbushIndex(result.featuresForFlatbush, self)
        }
        if (result.offsetPx !== undefined) {
          self.setLastDrawnOffsetPx(result.offsetPx)
        }
      }

      self.setLastDrawnBpPerPx(bpPerPx)
    } catch (error) {
      console.error(error)
      self.setError(error)
    } finally {
      self.setIsRendering(false)
    }
  }

  // Autorun for cloud mode
  createAutorun(
    self,
    async () => {
      if (!self.drawCloud) {
        return
      }

      // Only read cloud-specific property - shared properties read in performRender
      const height = self.height

      // Fire off the async render but don't await it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender(true, height)
    },
    { delay: 1000 },
  )

  // Autorun for stack mode
  createAutorun(
    self,
    async () => {
      if (self.drawCloud) {
        return
      }

      // Only read stack-specific property - shared properties read in performRender
      const height = self.trackMaxHeight ?? 10000

      // Fire off the async render but don't await it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender(false, height)
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

    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(renderingImageData, 0, 0)
  })
}
