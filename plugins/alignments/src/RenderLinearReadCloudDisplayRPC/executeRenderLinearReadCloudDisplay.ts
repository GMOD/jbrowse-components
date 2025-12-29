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

import { calculateCloudYOffsetsUtil } from './drawFeatsCloud'
import {
  computeChainBounds,
  drawFeatsCore,
  filterChains,
  sortComputedChains,
} from './drawFeatsCommon'
import { calculateStackYOffsetsUtil } from './drawFeatsStack'
import { getInsertSizeStats } from '../shared/insertSizeStats'

import type { RenderLinearReadCloudDisplayArgs } from './RenderLinearReadCloudDisplay'
import type { ComputedChain } from './drawFeatsCommon'
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
    hideSmallIndels,
    hideMismatches,
    hideLargeIndels,
    showOutline,
  } = args

  // Recreate the view from the snapshot (displayedRegions already have renamed refNames)
  const view = Base1DView.create(viewSnapshot)
  // Set the volatile width which is not part of the snapshot
  if (viewSnapshot.width) {
    view.setVolatileWidth(viewSnapshot.width)
  }

  // Extract properties from the recreated view
  const { bpPerPx, offsetPx } = view
  const width = view.staticBlocks.totalWidthPx
  // contentBlocks are derived from displayedRegions, so they have correct refNames
  const regions = view.staticBlocks.contentBlocks
  const assemblyName = view.assemblyNames[0]
  if (!assemblyName) {
    throw new Error('No assembly name found in view')
  }

  // Create a snapshot from the live view including computed properties
  // staticBlocks is a getter so must be included explicitly
  const snap = getSnapshot(view)
  const viewSnap = {
    ...snap,
    width: view.width,
    staticBlocks: view.staticBlocks,
    bpToPx(arg: { refName: string; coord: number }) {
      const res = bpToPx({
        self: this,
        refName: arg.refName,
        coord: arg.coord,
      })
      return res !== undefined
        ? { offsetPx: res.offsetPx, index: res.index }
        : undefined
    },
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
      // Single pass: collect valid TLENs for stats calculation
      // Only use reads with proper paired flag (flag 2), skip secondary/supplementary
      const tlens: number[] = []
      for (const f of deduped) {
        const flags = f.get('flags')
        // Only keep reads mapped in proper pair (flag 2)
        // Skip secondary (256) and supplementary (2048) alignments
        if (flags & 2 && !(flags & 256) && !(flags & 2048)) {
          const tlen = f.get('template_length')
          if (tlen !== 0 && !Number.isNaN(tlen)) {
            tlens.push(Math.abs(tlen))
          }
        }
      }

      let statsResult
      if (tlens.length > 0) {
        const insertSizeStats = getInsertSizeStats(tlens)
        statsResult = {
          ...insertSizeStats,
          max: max(tlens),
          min: min(tlens),
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

  let actualHeight: number
  if (drawCloud) {
    if (cloudModeHeight === undefined) {
      throw new Error('cloudModeHeight is required when drawCloud is true')
    }
    actualHeight = cloudModeHeight
  } else {
    actualHeight = calculateStackYOffsetsUtil(
      computedChains,
      featureHeight,
      noSpacing,
      trackMaxHeight ?? 1200,
    ).layoutHeight
  }

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
          cloudScaleInfo,
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
            hideSmallIndels,
            hideMismatches,
            hideLargeIndels,
            showOutline,
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
          cloudScaleInfo,
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
