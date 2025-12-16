import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { getSnapshot, isAlive } from '@jbrowse/mobx-state-tree'
import { untracked } from 'mobx'

import { createAutorun } from '../util'
import {
  buildFlatbushIndex,
  buildMismatchFlatbushIndex,
} from './drawFeatsCommon'
import { getUniqueModifications } from '../shared/getUniqueModifications'

import type { LinearReadCloudDisplayModel } from './model'
import type { FlatbushEntry } from '../shared/flatbushType'
import type { FlatbushItem } from '../PileupRenderer/types'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

interface RenderResult {
  imageData?: ImageBitmap
  layoutHeight?: number
  featuresForFlatbush?: FlatbushEntry[]
  mismatchFlatbush?: ArrayBuffer
  mismatchItems?: FlatbushItem[]
  offsetPx?: number
}

export function doAfterAttachRPC(self: LinearReadCloudDisplayModel) {
  // Common rendering logic
  const performRender = async (drawCloud: boolean) => {
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
      featureHeightSetting: featureHeight,
      colorBy,
      filterBy,
      drawSingletons,
      drawProperPairs,
      flipStrandLongReadChains,
      noSpacing,
      trackMaxHeight,
      height,
      visibleModifications,
    } = self

    try {
      const session = getSession(self)
      const { rpcManager, assemblyManager } = session
      const assemblyName = view.assemblyNames[0]
      if (!assemblyName) {
        return
      }

      // Get the sequenceAdapter config for CRAM files that need it
      const assembly = assemblyManager.get(assemblyName)
      const sequenceAdapterConfig = assembly?.configuration?.sequence?.adapter
      const sequenceAdapter = sequenceAdapterConfig
        ? getSnapshot(sequenceAdapterConfig)
        : undefined

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
        'RenderLinearReadCloudDisplay',
        {
          sessionId: session.id,
          view: viewSnapshot,
          adapterConfig: self.adapterConfig,
          sequenceAdapter,
          config: getSnapshot(self.configuration),
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
          visibleModifications: Object.fromEntries(visibleModifications.toJSON()),
          ...(drawCloud && { cloudModeHeight: height }),
          highResolutionScaling: 2,
          rpcDriverName: self.effectiveRpcDriverName,
          statusCallback: (msg: string) => {
            if (isAlive(self)) {
              self.setStatusMessage(msg)
            }
          },
          stopToken,
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
        if (result.mismatchFlatbush && result.mismatchItems) {
          buildMismatchFlatbushIndex(
            result.mismatchFlatbush,
            result.mismatchItems,
            self,
          )
        }
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

  // Autorun for cloud mode
  createAutorun(
    self,
    async () => {
      if (!self.drawCloud || !isAlive(self)) {
        return
      }

      // Fire off the async render but don't await it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender(true)
    },
    {
      delay: 1000,
      name: 'StackRender',
    },
  )

  // Autorun for stack mode
  createAutorun(
    self,
    async () => {
      if (self.drawCloud || !isAlive(self)) {
        return
      }

      // Fire off the async render but don't await it
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      performRender(false)
    },
    {
      delay: 1000,
      name: 'CloudRender',
    },
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
    {
      name: 'LinearReadCloudRenderCanvas',
    },
  )

  // Autorun to discover modifications in the visible region
  createAutorun(
    self,
    async () => {
      const view = getContainingView(self) as LGV
      if (!view.initialized || !self.featureDensityStatsReadyAndRegionNotTooLarge) {
        return
      }

      const { adapterConfig } = self
      const { staticBlocks } = view
      const { modifications, simplexModifications } =
        await getUniqueModifications({
          model: self,
          adapterConfig,
          blocks: staticBlocks,
        })
      if (isAlive(self)) {
        self.updateVisibleModifications(modifications)
        self.setSimplexModifications(simplexModifications)
        self.setModificationsReady(true)
      }
    },
    {
      delay: 1000,
      name: 'GetModInfo',
    },
  )
}
