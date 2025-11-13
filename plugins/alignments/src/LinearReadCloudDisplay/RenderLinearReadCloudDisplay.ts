import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { dedupe, groupBy, renderToAbstractCanvas } from '@jbrowse/core/util'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { getClip } from '../MismatchParser'
import { filterForPairs, getInsertSizeStats } from '../PileupRPC/util'

import type { BaseFeatureDataAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { ChainData } from '../shared/fetchChains'
import type { Region } from '@jbrowse/core/util'

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

/**
 * Simple helper to convert base pair coordinates to pixel coordinates
 * for RPC rendering context
 */
function bpToPxSimple({
  refName,
  coord,
  regions,
  bpPerPx,
}: {
  refName: string
  coord: number
  regions: Region[]
  bpPerPx: number
}): { offsetPx: number } | undefined {
  for (const region of regions) {
    if (
      refName === region.refName &&
      coord >= region.start &&
      coord <= region.end
    ) {
      const bpOffset = region.reversed
        ? region.end - coord
        : coord - region.start
      return {
        offsetPx: Math.round(bpOffset / bpPerPx),
      }
    }
  }
  return undefined
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
      filterBy,
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
    const chains = groupBy(reduced, f => f.name)

    const chainData: ChainData = {
      chains: Object.values(chains),
      stats,
    }

    // Create a mock view object with the necessary properties
    // offsetPx is positive when scrolled right
    const view: any = {
      bpPerPx,
      offsetPx,
      assemblyNames: [assemblyName],
      bpToPx: (arg: { refName: string; coord: number }) => {
        return bpToPxSimple({
          refName: arg.refName,
          coord: arg.coord,
          regions,
          bpPerPx,
        })
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

    // Import the drawing functions
    const { drawFeatsCore } = await import('./drawFeatsCommon')

    // Import the appropriate calculate Y offsets function
    const calculateYOffsets = drawCloud
      ? (await import('./drawFeatsCloud')).calculateCloudYOffsetsCore
      : (await import('./drawFeatsStack')).calculateStackYOffsetsCore

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
          view: any,
          featureHeight: number,
        ) => {
          // Always pass height, even for stack mode (it just won't use it)
          return calculateYOffsets(
            computedChains,
            params,
            view,
            featureHeight,
            height,
          )
        }

        // Call the drawing function
        const { layoutHeight, featuresForFlatbush } = drawFeatsCore(
          ctx,
          params,
          view,
          asm,
          wrappedCalculateYOffsets,
        )
        return { layoutHeight, featuresForFlatbush }
      },
    )

    return result
  }
}
