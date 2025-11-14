import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { dedupe, groupBy, renderToAbstractCanvas } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import Base1DView from '@jbrowse/core/util/Base1DViewModel'
import { getSnapshot } from 'mobx-state-tree'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import configSchema from './configSchema'
import { calculateCloudYOffsetsUtil } from './drawFeatsCloud'
import { drawFeatsCore } from './drawFeatsCommon'
import { calculateStackYOffsetsCore } from './drawFeatsStack'
import { getInsertSizeStats } from '../PileupRPC/util'

import type { ComputedChain, DrawFeatsParams } from './drawFeatsCommon'
import type { ChainData } from '../shared/fetchChains'
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
  height: number
  highResolutionScaling?: number
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
}

export default class RenderLinearReadCloudDisplay extends RpcMethodType {
  name = 'RenderLinearReadCloudDisplay'

  deserializeArguments(args: any, rpcDriver: string) {
    return {
      ...args,
      config:
        rpcDriver !== 'MainThreadRpcDriver'
          ? configSchema(this.pluginManager).create(args.config, {
              pluginManager: this.pluginManager,
            })
          : args.config,
    }
  }
  async execute(args: RenderLinearReadCloudDisplayArgs, rpcDriver: string) {
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
      height,
      highResolutionScaling,
      exportSVG,
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
          },
          view: viewSnap,
          calculateYOffsets: (
            chains: ComputedChain[],
            params: DrawFeatsParams,
            featureHeight: number,
          ) => {
            return drawCloud
              ? calculateCloudYOffsetsUtil(chains, height)
              : calculateStackYOffsetsCore(chains, params, featureHeight)
          },
        })
        return {
          layoutHeight,
          featuresForFlatbush,
        }
      },
    )

    // Include the offsetPx in the result so the main thread can position the canvas correctly
    return {
      ...result,
      offsetPx,
      containsNoTransferables: true,
    }
  }
}
