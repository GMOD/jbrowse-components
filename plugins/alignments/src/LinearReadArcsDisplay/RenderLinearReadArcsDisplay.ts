import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import {
  dedupe,
  groupBy,
  max,
  min,
  renameRegionsIfNeeded,
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

import configSchema from './configSchema'
import { drawFeatsRPC } from './drawFeatsRPC'
import { getInsertSizeStats } from '../shared/insertSizeStats'

import type { ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ThemeOptions } from '@mui/material'

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

export interface RenderLinearReadArcsDisplayArgs {
  sessionId: string
  view: Base1DViewModel
  adapterConfig: AnyConfigurationModel
  config: AnyConfigurationModel
  theme: ThemeOptions
  filterBy: Record<string, unknown>
  colorBy: ColorBy
  drawInter: boolean
  drawLongRange: boolean
  lineWidth: number
  jitter: number
  height: number
  highResolutionScaling?: number
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  statusCallback?: (status: string) => void
  stopToken?: string
}

export default class RenderLinearReadArcsDisplay extends RpcMethodType {
  name = 'RenderLinearReadArcsDisplay'

  deserializeArguments(args: any, _rpcDriver: string) {
    return {
      ...args,
      config: configSchema(this.pluginManager).create(args.config, {
        pluginManager: this.pluginManager,
      }),
    }
  }

  async renameRegionsIfNeeded(
    args: RenderLinearReadArcsDisplayArgs,
  ): Promise<RenderLinearReadArcsDisplayArgs> {
    const pm = this.pluginManager
    const assemblyManager = pm.rootModel?.session?.assemblyManager

    if (!assemblyManager) {
      throw new Error('no assembly manager')
    }

    const { view: viewSnapshot, sessionId, adapterConfig } = args
    const displayedRegions =
      (viewSnapshot as any).displayedRegions || ([] as any[])

    if (!displayedRegions.length) {
      return args
    }

    const result = await renameRegionsIfNeeded(assemblyManager, {
      sessionId,
      adapterConfig,
      regions: displayedRegions,
    })

    return {
      ...args,
      view: {
        ...viewSnapshot,
        displayedRegions: result.regions,
        staticBlocks: {
          ...(viewSnapshot as any).staticBlocks,
          contentBlocks: result.regions,
        },
      },
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderLinearReadArcsDisplayArgs,
    )
    return super.serializeArguments(
      renamed as unknown as Record<string, unknown>,
      rpcDriver,
    )
  }

  async execute(args: Record<string, unknown>, rpcDriver: string) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)

    const {
      sessionId,
      view: viewSnapshot,
      adapterConfig,
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
    } = deserializedArgs

    // Recreate the view from the snapshot following DotplotRenderer pattern
    const view = Base1DView.create(viewSnapshot)
    // Set the volatile width which is not part of the snapshot
    if (viewSnapshot.width) {
      view.setVolatileWidth(viewSnapshot.width)
    }

    // Extract properties from the recreated view
    const { offsetPx } = view
    const width = view.staticBlocks.totalWidthPx
    const regions = view.staticBlocks.contentBlocks

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
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await updateStatus(
      'Fetching alignments',
      statusCallback,
      () =>
        firstValueFrom(
          dataAdapter
            .getFeaturesInMultipleRegions(regions, deserializedArgs)
            .pipe(toArray()),
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
    if (result.imageData instanceof ImageBitmap) {
      return rpcResult(serialized, [result.imageData])
    }
    return serialized
  }
}
