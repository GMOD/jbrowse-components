import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import {
  collectTransferables,
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
import { calculateCloudYOffsetsUtil } from './drawFeatsCloud'
import {
  computeChainBounds,
  drawFeatsCore,
  filterChains,
  sortComputedChains,
} from './drawFeatsCommon'
import { calculateStackYOffsetsCore } from './drawFeatsStack'
import { getInsertSizeStats } from '../shared/insertSizeStats'

import type { ComputedChain, DrawFeatsParams } from './drawFeatsCommon'
import type { ColorBy } from '../shared/types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Base1DViewModel } from '@jbrowse/core/util/Base1DViewModel'
import type { ThemeOptions } from '@mui/material'

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

export interface RenderLinearReadCloudDisplayArgs {
  sessionId: string
  view: Base1DViewModel
  adapterConfig: AnyConfigurationModel
  config: AnyConfigurationModel
  theme: ThemeOptions
  filterBy: Record<string, unknown>
  featureHeight: number
  noSpacing: boolean
  drawCloud: boolean
  colorBy: ColorBy
  drawSingletons: boolean
  drawProperPairs: boolean
  flipStrandLongReadChains: boolean
  trackMaxHeight?: number
  cloudModeHeight?: number
  highResolutionScaling?: number
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  statusCallback?: (status: string) => void
  stopToken?: string
}

export default class RenderLinearReadCloudDisplay extends RpcMethodType {
  name = 'RenderLinearReadCloudDisplay'

  async renameRegionsIfNeeded(
    args: RenderLinearReadCloudDisplayArgs,
  ): Promise<RenderLinearReadCloudDisplayArgs> {
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

  deserializeArguments(args: any, _rpcDriver: string) {
    return {
      ...args,
      config: configSchema(this.pluginManager).create(args.config, {
        pluginManager: this.pluginManager,
      }),
    }
  }

  async serializeArguments(args: Record<string, unknown>, rpcDriver: string) {
    const renamed = await this.renameRegionsIfNeeded(
      args as unknown as RenderLinearReadCloudDisplayArgs,
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
    } = deserializedArgs

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
      : calculateStackYOffsetsCore(
          computedChains,
          {
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
          },
          featureHeight,
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
          const { layoutHeight, featuresForFlatbush } = drawFeatsCore({
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
            },
            view: viewSnap,
            calculateYOffsets: (
              chains: ComputedChain[],
              params: DrawFeatsParams,
              featureHeight: number,
            ) => {
              return drawCloud
                ? calculateCloudYOffsetsUtil(chains, actualHeight)
                : calculateStackYOffsetsCore(chains, params, featureHeight)
            },
          })
          return {
            layoutHeight,
            featuresForFlatbush,
          }
        }),
    )

    // Include the offsetPx in the result so the main thread can position the canvas correctly
    const serialized = { ...result, offsetPx }
    return rpcResult(serialized, collectTransferables(result))
  }
}
