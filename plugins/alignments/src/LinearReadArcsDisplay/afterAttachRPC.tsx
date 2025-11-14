import { getContainingView, getSession } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { untracked } from 'mobx'
import { getSnapshot } from 'mobx-state-tree'

import { createAutorun } from '../util'

import type { LinearReadArcsDisplayModel } from './model'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  offsetPx?: number
}

export function doAfterAttachRPC(self: LinearReadArcsDisplayModel) {
  // Common rendering logic
  const performRender = async (height: number) => {
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

    const { bpPerPx } = view
    const {
      colorBy,
      filterBy,
      drawInter,
      drawLongRange,
      lineWidthSetting,
      jitterVal,
    } = self

    try {
      self.setIsRendering(true)

      const session = getSession(self)
      const { rpcManager } = session
      const assemblyName = view.assemblyNames[0]
      if (!assemblyName) {
        return
      }

      // Stop any previous rendering operation
      if (self.renderingStopToken) {
        stopStopToken(self.renderingStopToken)
      }

      // Create stop token for this render operation
      const stopToken = createStopToken()
      self.setRenderingStopToken(stopToken)

      // Serialize the full view snapshot for RPC
      // Include staticBlocks and width which are not part of the regular snapshot
      const viewSnapshot = structuredClone({
        ...getSnapshot(view),
        staticBlocks: view.staticBlocks,
        width: view.width,
      })

      // Call RPC method - it will fetch chainData internally
      const result = (await rpcManager.call(
        self.id,
        'RenderLinearReadArcsDisplay',
        {
          sessionId: session.id,
          view: viewSnapshot,
          adapterConfig: self.adapterConfig,
          config: self.configuration,
          theme: session.theme,
          filterBy,
          colorBy,
          drawInter,
          drawLongRange,
          lineWidth: lineWidthSetting,
          jitter: jitterVal,
          height,
          highResolutionScaling: 2,
          stopToken,
        },
      )) as RenderResult

      // Store the result
      if (result.imageData) {
        self.setRenderingImageData(result.imageData)
        if (result.offsetPx !== undefined) {
          self.setLastDrawnOffsetPx(result.offsetPx)
        }
      }

      self.setLastDrawnBpPerPx(bpPerPx)
    } catch (error) {
      console.error(error)
      self.setError(error)
    } finally {
      self.setRenderingStopToken(undefined)
      self.setIsRendering(false)
    }
  }

  // Autorun for rendering
  createAutorun(
    self,
    async () => {
      const height = self.height

      // Fire off the async render but don't await it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender(height)
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
