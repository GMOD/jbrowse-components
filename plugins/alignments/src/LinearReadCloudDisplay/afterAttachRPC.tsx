import { getContainingView, getSession } from '@jbrowse/core/util'

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
  // Common rendering function shared by both autoruns
  const performRender = async () => {
    const view = getContainingView(self) as LGV

    // Check if we have the necessary conditions to render
    if (
      !view.initialized ||
      self.error ||
      !self.statsReadyAndRegionNotTooLarge
    ) {
      return
    }

    // Don't render if already rendering
    if (self.isRendering) {
      return
    }

    // Get current view state
    const { bpPerPx, offsetPx } = view

    // Skip if view hasn't changed since last render
    if (
      self.lastDrawnBpPerPx === bpPerPx &&
      self.lastDrawnOffsetPx === offsetPx
    ) {
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
      // For cloud mode, use fixed height. For stack mode, use trackMaxHeight or large default
      const height = self.drawCloud
        ? self.height
        : (self.trackMaxHeight ?? 10000)
      const regions = view.dynamicBlocks.contentBlocks

      // Call RPC method - it will fetch chainData internally
      const result = (await rpcManager.call(
        self.id,
        'RenderLinearReadCloudDisplay',
        {
          sessionId: session.id,
          regions,
          adapterConfig: self.adapterConfig,
          filterBy: self.filterBy,
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
      )) as RenderResult

      // Store the result
      if (result.imageData) {
        self.setRenderingImageData(result.imageData)
        if (result.layoutHeight !== undefined) {
          self.setLayoutHeight(result.layoutHeight)
        }
        if (result.featuresForFlatbush) {
          buildFlatbushIndex(result.featuresForFlatbush, self)
        }
        // Store the offsetPx that was used to render this image
        if (result.offsetPx !== undefined) {
          self.setLastDrawnOffsetPx(result.offsetPx)
        }
      }

      self.setLastDrawnBpPerPx(view.bpPerPx)
    } catch (error) {
      console.error(error)
      self.setError(error)
    } finally {
      self.setIsRendering(false)
    }
  }

  // Autorun for cloud mode - observes view changes and height
  createAutorun(
    self,
    () => {
      if (!self.drawCloud) {
        return
      }

      const view = getContainingView(self) as LGV
      // Access only the properties we need for cloud mode
      const { bpPerPx, offsetPx } = view
      const { height } = self

      // These accesses register them as dependencies
      void bpPerPx
      void offsetPx
      void height

      // Fire off the async render but don't await it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender()
    },
    { delay: 1000 },
  )

  // Autorun for stack mode - observes view changes, trackMaxHeight, noSpacing
  createAutorun(
    self,
    () => {
      if (self.drawCloud) {
        return
      }

      const view = getContainingView(self) as LGV
      // Access only the properties we need for stack mode
      const { bpPerPx, offsetPx } = view
      const { trackMaxHeight, noSpacing } = self

      // These accesses register them as dependencies
      void bpPerPx
      void offsetPx
      void trackMaxHeight
      void noSpacing

      // Fire off the async render but don't await it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender()
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
