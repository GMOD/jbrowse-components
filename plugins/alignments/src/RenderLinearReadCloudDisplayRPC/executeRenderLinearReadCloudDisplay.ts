import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import {
  collectTransferables,
  dedupe,
  groupBy,
  max,
  min,
  renderToAbstractCanvas,
  updateStatus,
} from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { rpcResult } from 'librpc-web-mod'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { calculateCloudYOffsetsUtil } from '../LinearReadCloudDisplay/drawFeatsCloud'
import {
  computeChainBounds,
  drawFeatsCore,
  filterChains,
  sortComputedChains,
} from '../LinearReadCloudDisplay/drawFeatsCommon'
import { calculateStackYOffsetsUtil } from '../LinearReadCloudDisplay/drawFeatsStack'
import { getInsertSizeStats } from '../shared/insertSizeStats'

import type { RenderLinearReadCloudDisplayArgs } from './RenderLinearReadCloudDisplay'
import type { ComputedChain } from '../LinearReadCloudDisplay/drawFeatsCommon'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

export async function executeRenderLinearReadCloudDisplay({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderLinearReadCloudDisplayArgs
}) {
  const {
    sessionId,
    view: viewSnapshot,
    adapterConfig,
    sequenceAdapter,
    config,
    theme,
    featureHeight,
    noSpacing,
    drawCloud,
    colorBy,
    drawSingletons,
    drawProperPairs,
    flipStrandLongReadChains,
    trackMaxHeight,
    cloudModeHeight,
    highResolutionScaling,
    exportSVG,
    statusCallback = () => {},
    stopToken,
    visibleModifications,
  } = args

  // Recreate the view from the snapshot following DotplotRenderer pattern
  const view = Base1DView.create(viewSnapshot)
  // Set the volatile width which is not part of the snapshot
  if (viewSnapshot.width) {
    view.setVolatileWidth(viewSnapshot.width)
  }

  // Extract properties from the recreated view
  const { bpPerPx, offsetPx } = view
  const width = view.staticBlocks.totalWidthPx
  const regions = view.staticBlocks.contentBlocks
  const assemblyName = view.assemblyNames[0]
  if (!assemblyName) {
    throw new Error('No assembly name found in view')
  }

  // Create a snapshot from the live view including computed properties
  // Following the DotplotRenderer pattern
  const viewSnap: any = {
    ...getSnapshot(view),
    staticBlocks: view.staticBlocks,
    width: view.width,
  }
  // Add bpToPx method after viewSnap is defined to avoid circular reference
  viewSnap.bpToPx = (arg: { refName: string; coord: number }) => {
    const res = bpToPx({
      self: viewSnap,
      refName: arg.refName,
      coord: arg.coord,
    })
    return res !== undefined
      ? {
          offsetPx: res.offsetPx,
          index: res.index,
        }
      : undefined
  }

  // Fetch chainData directly in the RPC to avoid serializing features from main thread
  const dataAdapter = (
    await getAdapter(pluginManager, sessionId, adapterConfig)
  ).dataAdapter as BaseFeatureDataAdapter

  // Set sequenceAdapterConfig on the adapter for CRAM files that need it
  if (sequenceAdapter && !dataAdapter.sequenceAdapterConfig) {
    dataAdapter.setSequenceAdapterConfig(sequenceAdapter)
  }

  const featuresArray = await updateStatus(
    'Fetching alignments',
    statusCallback,
    () =>
      firstValueFrom(
        dataAdapter.getFeaturesInMultipleRegions(regions, args).pipe(toArray()),
      ),
  )

  // Check stop token after fetching features
  checkStopToken(stopToken)

  // Dedupe features by ID while preserving full Feature objects
  const deduped = dedupe(featuresArray, f => f.id())

  // Process chain data with status updates
  const { chains, stats } = await updateStatus(
    'Processing alignments',
    statusCallback,
    async () => {
      // For stats calculation, only use reads with proper paired flag (flag 2)
      const filtered = deduped.filter(f => {
        const flags = f.get('flags')
        // Only keep reads mapped in proper pair (flag 2)
        if (!(flags & 2)) {
          return false
        }
        // Skip secondary and supplementary alignments
        if (flags & 256 || flags & 2048) {
          return false
        }
        return true
      })
      let statsResult
      if (filtered.length) {
        // Filter out features without valid TLEN values
        const validTlenFeatures = filtered.filter(f => {
          const tlen = f.get('template_length')
          return tlen !== 0 && !Number.isNaN(tlen)
        })
        if (validTlenFeatures.length > 0) {
          const tlens = validTlenFeatures.map(f =>
            Math.abs(f.get('template_length')),
          )
          const insertSizeStats = getInsertSizeStats(tlens)
          statsResult = {
            ...insertSizeStats,
            max: max(tlens),
            min: min(tlens),
          }
        }
      }

      const chainsResult = Object.values(groupBy(deduped, f => f.get('name')))
      return {
        chains: chainsResult,
        stats: statsResult,
      }
    },
  )

  const chainData = { chains, stats }

  // Check stop token after processing chain data
  checkStopToken(stopToken)

  // Pre-calculate actual layout height to avoid oversized canvas
  const { computedChains } = await updateStatus(
    'Calculating layout',
    statusCallback,
    async () => {
      const filtered = filterChains(
        chains,
        drawSingletons,
        drawProperPairs,
        colorBy.type || 'insertSizeAndOrientation',
        chainData,
      )
      const computed = computeChainBounds(filtered, viewSnap)
      sortComputedChains(computed)
      return {
        filteredChains: filtered,
        computedChains: computed,
      }
    },
  )

  const actualHeight = drawCloud
    ? (cloudModeHeight ?? 1200)
    : calculateStackYOffsetsUtil(
        computedChains,
        featureHeight,
        noSpacing,
        trackMaxHeight ?? 1200,
      ).layoutHeight

  const renderOpts: RenderToAbstractCanvasOptions = {
    highResolutionScaling,
    exportSVG,
  }

  // Render using renderToAbstractCanvas with actual height
  const result = await updateStatus(
    'Rendering alignments',
    statusCallback,
    () =>
      renderToAbstractCanvas(width, actualHeight, renderOpts, async ctx => {
        const {
          layoutHeight,
          featuresForFlatbush,
          mismatchFlatbush,
          mismatchItems,
        } = drawFeatsCore({
          ctx,
          params: {
            chainData,
            featureHeight,
            canvasWidth: width,
            noSpacing,
            colorBy,
            drawSingletons,
            drawProperPairs,
            flipStrandLongReadChains,
            trackMaxHeight,
            config,
            theme,
            regions,
            bpPerPx,
            stopToken,
            visibleModifications,
          },
          view: viewSnap,
          calculateYOffsets: (chains: ComputedChain[]) => {
            return drawCloud
              ? calculateCloudYOffsetsUtil(chains, actualHeight)
              : calculateStackYOffsetsUtil(
                  chains,
                  featureHeight,
                  noSpacing,
                  trackMaxHeight ?? 1200,
                )
          },
        })
        return {
          layoutHeight,
          featuresForFlatbush,
          mismatchFlatbush,
          mismatchItems,
        }
      }),
  )

  // Include the offsetPx in the result so the main thread can position the canvas correctly
  const serialized = { ...result, offsetPx }
  return rpcResult(serialized, collectTransferables(result))
}
