import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

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
      !self.featureDensityStatsReadyAndRegionNotTooLarge
    ) {
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
      const session = getSession(self)
      const { rpcManager } = session
      const assemblyName = view.assemblyNames[0]
      if (!assemblyName) {
        return
      }

      // Stop any previous rendering operation (use untracked to avoid triggering reactions)
      const previousToken = untracked(() => self.renderingStopToken)
      if (previousToken) {
        stopStopToken(previousToken)
      }

      // Create stop token for this render operation
      const stopToken = createStopToken()
      self.setRenderingStopToken(stopToken)
      self.setLoading(true)

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
          config: getSnapshot(self.configuration),
          theme: session.theme,
          filterBy,
          colorBy,
          drawInter,
          drawLongRange,
          lineWidth: lineWidthSetting,
          jitter: jitterVal,
          height,
          highResolutionScaling: 2,
          rpcDriverName: self.effectiveRpcDriverName,
          statusCallback: (msg: string) => {
            self.setMessage(msg)
          },
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
      if (!isAbortException(error)) {
        self.setError(error)
      }
    } finally {
      self.setRenderingStopToken(undefined)
      self.setLoading(false)
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
    { delay: 1000, name: 'PerformRender' },
  )

  // Autorun to draw the imageData to canvas when available
  createAutorun(
    self,
    async () => {
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
    },
    { name: 'RenderCanvas' },
  )
}
