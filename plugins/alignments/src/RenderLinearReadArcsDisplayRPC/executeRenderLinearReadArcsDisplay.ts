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
import { rpcResult } from '@jbrowse/core/util/librpc'
import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { drawFeatsRPC } from './drawFeatsRPC'
import { getInsertSizeStats } from '../shared/insertSizeStats'

import type { RenderLinearReadArcsDisplayArgs } from './RenderLinearReadArcsDisplay'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

export async function executeRenderLinearReadArcsDisplay({
  pluginManager,
  args,
}: {
  pluginManager: PluginManager
  args: RenderLinearReadArcsDisplayArgs
}) {
  const {
    sessionId,
    view: viewSnapshot,
    adapterConfig,
    sequenceAdapter,
    colorBy,
    drawInter,
    drawLongRange,
    lineWidth,
    jitter,
    height,
    highResolutionScaling,
    exportSVG,
    statusCallback = () => {},
    stopToken,
  } = args

  // Recreate the view from the snapshot (displayedRegions already have renamed refNames)
  const view = Base1DView.create(viewSnapshot)
  // Set the volatile width which is not part of the snapshot
  if (viewSnapshot.width) {
    view.setVolatileWidth(viewSnapshot.width)
  }

  // Extract properties from the recreated view
  const { offsetPx } = view
  const width = view.staticBlocks.totalWidthPx
  // contentBlocks are derived from displayedRegions, so they have correct refNames
  const regions = view.staticBlocks.contentBlocks

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

  // Process chain data with status updates
  const { chains, stats } = await updateStatus(
    'Processing alignments',
    statusCallback,
    async () => {
      // Dedupe features by ID while preserving full Feature objects
      const deduped = dedupe(featuresArray, f => f.id())

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

  const chainData = {
    chains,
    stats,
  }

  // Check stop token after processing chain data
  checkStopToken(stopToken)

  const renderOpts: RenderToAbstractCanvasOptions = {
    highResolutionScaling,
    exportSVG,
  }

  // Render using renderToAbstractCanvas
  const result = await updateStatus('Rendering arcs', statusCallback, () =>
    renderToAbstractCanvas(width, height, renderOpts, ctx => {
      // Call drawFeatsRPC with all necessary parameters
      drawFeatsRPC({
        ctx,
        width,
        height,
        chainData,
        colorBy,
        drawInter,
        drawLongRange,
        lineWidth,
        jitter,
        view: viewSnap,
        offsetPx,
        stopToken,
      })
      return undefined
    }),
  )

  // Include the offsetPx in the result so the main thread can position the
  // canvas correctly
  const serialized = { ...result, offsetPx }
  return rpcResult(serialized, collectTransferables(result))
}
