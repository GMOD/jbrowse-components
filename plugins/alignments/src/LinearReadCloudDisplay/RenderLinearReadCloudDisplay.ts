import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { dedupe, groupBy, renderToAbstractCanvas } from '@jbrowse/core/util'
import { bpToPx } from '@jbrowse/core/util/Base1DUtils'
import calculateStaticBlocks from '@jbrowse/core/util/calculateStaticBlocks'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'
import { calculateCloudYOffsetsCore } from './drawFeatsCloud'
import { calculateStackYOffsetsCore } from './drawFeatsStack'

import { drawFeatsCore } from './drawFeatsCommon'

import { getClip } from '../MismatchParser'
import { filterForPairs, getInsertSizeStats } from '../PileupRPC/util'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ChainData } from '../shared/fetchChains'
import type { Region } from '@jbrowse/core/util'

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

export interface RenderLinearReadCloudDisplayArgs {
  sessionId: string
  regions: Region[]
  adapterConfig: Record<string, unknown>
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

    const reduced = dedupe(
      featuresArray.map(f => ({
        id: f.id(),
        refName: f.get('refName'),
        name: f.get('name'),
        start: f.get('start'),
        strand: f.get('strand'),
        end: f.get('end'),
        flags: f.get('flags'),
        tlen: f.get('template_length'),
        pair_orientation: f.get('pair_orientation'),
        next_ref: f.get('next_ref'),
        next_pos: f.get('next_pos'),
        clipPos: getClip(f.get('CIGAR'), f.get('strand')),
        SA: f.get('tags')?.SA,
      })),
      f => f.id,
    )

    const filtered = filterForPairs(reduced)
    let stats
    if (filtered.length) {
      const insertSizeStats = getInsertSizeStats(filtered)
      const tlens = filtered.map(f => Math.abs(f.tlen))
      stats = {
        ...insertSizeStats,
        max: Math.max(...tlens),
        min: Math.min(...tlens),
      }
    }

    const chainData: ChainData = {
      chains: Object.values(groupBy(reduced, f => f.name)),
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

    const viewSnap: any = {
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

    // Create a mock assembly object that assumes refNames are canonical
    const asm = {
      getCanonicalRefName: (refName: string) => refName,
      getCanonicalRefName2: (refName: string) => refName,
    }

    // Create params object for drawing
    const params = {
      chainData,
      featureHeight,
      noSpacing,
      colorBy,
      drawSingletons,
      drawProperPairs,
      flipStrandLongReadChains,
      trackMaxHeight,
    }

    const renderOpts: RenderToAbstractCanvasOptions = {
      highResolutionScaling,
      exportSVG,
    }

    // Import the appropriate calculate Y offsets function
    const calculateYOffsets = drawCloud
      ? calculateCloudYOffsetsCore
      : calculateStackYOffsetsCore

    // Render using renderToAbstractCanvas
    const result = await renderToAbstractCanvas(
      width,
      height,
      renderOpts,
      async (ctx: CanvasRenderingContext2D) => {
        // Wrap calculateYOffsets to add height parameter
        const wrappedCalculateYOffsets = (
          computedChains: any,
          params: any,
          _view: any,
          featureHeight: number,
        ) => {
          // Always pass height, even for stack mode (it just won't use it)
          return calculateYOffsets(
            computedChains,
            params,
            viewSnap,
            featureHeight,
            height,
          )
        }

        // Call the drawing function
        const { layoutHeight, featuresForFlatbush } = drawFeatsCore(
          ctx,
          params,
          viewSnap,
          asm,
          wrappedCalculateYOffsets,
        )
        return { layoutHeight, featuresForFlatbush }
      },
    )

    return result
  }
}
