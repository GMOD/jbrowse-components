import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { dedupe, groupBy, renderToAbstractCanvas } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { calculateCloudYOffsetsUtil } from './drawFeatsCloud'
import { drawFeatsCore } from './drawFeatsCommon'
import { calculateStackYOffsetsCore } from './drawFeatsStack'
import { getInsertSizeStats } from '../PileupRPC/util'

import type { ComputedChain, DrawFeatsParams } from './drawFeatsCommon'
import type { ChainData } from '../shared/fetchChains'
import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Region } from '@jbrowse/core/util'

/**
 * Documents the minimal view snapshot interface for RPC rendering context
 * Provides the properties needed for coordinate calculations
 * Note: Not used as a type constraint - drawFeatsCore accepts `any` for flexibility
 */
interface ViewSnapshot {
  bpPerPx: number
  offsetPx: number
  assemblyNames: string[]
  displayedRegions: Region[]
  interRegionPaddingWidth: number
  minimumBlockWidth: number
  staticBlocks: ReturnType<typeof calculateStaticBlocks>
  width: number
  bpToPx: (arg: {
    refName: string
    coord: number
  }) => { offsetPx: number; index: number } | undefined
}

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

export interface RenderLinearReadCloudDisplayArgs {
  sessionId: string
  regions: Region[]
  adapterConfig: Record<string, unknown>
  config: Record<string, unknown>
  theme: Record<string, unknown>
  filterBy: Record<string, unknown>
  featureHeight: number
  noSpacing: boolean
  drawCloud: boolean
  colorBy: { type: string; tag?: string; extra?: Record<string, unknown> }
  drawSingletons: boolean
  drawProperPairs: boolean
  flipStrandLongReadChains: boolean
  trackMaxHeight?: number
  width: number
  height: number
  bpPerPx: number
  offsetPx: number
  assemblyName: string
  highResolutionScaling?: number
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
}

export default class RenderLinearReadCloudDisplay extends RpcMethodType {
  name = 'RenderLinearReadCloudDisplay'

  async execute(args: RenderLinearReadCloudDisplayArgs, rpcDriver: string) {
    const deserializedArgs = await this.deserializeArguments(args, rpcDriver)
    const {
      sessionId,
      regions,
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
      width,
      height,
      bpPerPx,
      offsetPx,
      assemblyName,
      highResolutionScaling,
      exportSVG,
    } = deserializedArgs

    // Fetch chainData directly in the RPC to avoid serializing features from main thread
    const dataAdapter = (
      await getAdapter(this.pluginManager, sessionId, adapterConfig)
    ).dataAdapter as BaseFeatureDataAdapter

    const featuresArray = await firstValueFrom(
      dataAdapter
        .getFeaturesInMultipleRegions(regions, deserializedArgs)
        .pipe(toArray()),
    )

    // Dedupe features by ID while preserving full Feature objects
    const deduped = dedupe(featuresArray, f => f.id())

    // For stats calculation, we still need to extract the template_length values
    const filtered = deduped.filter(f => {
      // Filter similar to what filterForPairs does
      const flags = f.get('flags')
      // Only keep paired reads
      if (!(flags & 1)) {
        return false
      }
      // Skip secondary and supplementary alignments for stats
      if (flags & 256 || flags & 2048) {
        return false
      }
      return true
    })
    let stats
    if (filtered.length) {
      // Filter out features without valid TLEN values
      const validTlenFeatures = filtered.filter(f => {
        const tlen = f.get('template_length')
        return tlen !== 0 && !Number.isNaN(tlen)
      })
      if (validTlenFeatures.length > 0) {
        // Convert to simple objects for getInsertSizeStats
        const simpleTlenFeatures = validTlenFeatures.map(f => ({
          tlen: f.get('template_length'),
        }))
        const insertSizeStats = getInsertSizeStats(simpleTlenFeatures)
        const tlens = validTlenFeatures.map(f =>
          Math.abs(f.get('template_length')),
        )
        stats = {
          ...insertSizeStats,
          max: Math.max(...tlens),
          min: Math.min(...tlens),
        }
      }
    }

    const chainData: ChainData = {
      chains: Object.values(groupBy(deduped, f => f.get('name'))),
      stats,
    }

    const staticBlocks = calculateStaticBlocks({
      displayedRegions: regions,
      bpPerPx,
      width,
      offsetPx,
      interRegionPaddingWidth: 0,
      minimumBlockWidth: 0,
    })

    const viewSnap: ViewSnapshot = {
      bpPerPx,
      offsetPx,
      assemblyNames: [assemblyName],
      displayedRegions: regions,
      interRegionPaddingWidth: 0,
      minimumBlockWidth: 0,
      staticBlocks: staticBlocks, // bpToPx expects staticBlocks property
      width,
      bpToPx: (arg: { refName: string; coord: number }) => {
        const res = bpToPx({
          self: viewSnap,
          refName: arg.refName,
          coord: arg.coord,
        })
        return res !== undefined
          ? {
              offsetPx: res.offsetPx + Math.max(0, viewSnap.offsetPx),
              index: res.index,
            }
          : undefined
      },
    }

    // Create params object for drawing

    const renderOpts: RenderToAbstractCanvasOptions = {
      highResolutionScaling,
      exportSVG,
    }

    // Render using renderToAbstractCanvas
    const result = await renderToAbstractCanvas(
      width,
      height,
      renderOpts,
      async (ctx: CanvasRenderingContext2D) => {
        const { layoutHeight, featuresForFlatbush } = drawFeatsCore(
          ctx,
          {
            chainData,
            featureHeight,
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
          },
          viewSnap,
          (
            computedChains: ComputedChain[],
            params: DrawFeatsParams,
            featureHeight: number,
          ) =>
            drawCloud
              ? calculateCloudYOffsetsUtil(computedChains, height)
              : calculateStackYOffsetsCore(
                  computedChains,
                  params,
                  featureHeight,
                ),
        )
        return { layoutHeight, featuresForFlatbush }
      },
    )

    // Include the offsetPx in the result so the main thread can position the canvas correctly
    console.log({ result })
    return {
      ...result,
      offsetPx,
      containsNoTransferables: true,
    }
  }
}
