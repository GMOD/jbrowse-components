import RpcMethodType from '@jbrowse/core/pluggableElementTypes/RpcMethodType'
import { renderToAbstractCanvas } from '@jbrowse/core/util'

import type { ChainData } from '../shared/fetchChains'
import type { Region } from '@jbrowse/core/util'

interface RenderToAbstractCanvasOptions {
  exportSVG?: { rasterizeLayers?: boolean; scale?: number }
  highResolutionScaling?: number
}

export interface RenderLinearReadCloudDisplayArgs {
  regions: Region[]
  chainData: ChainData
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
      regions,
      chainData,
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

    // Create region lookup map for fast bpToPx calculations
    // Assume refNames are already canonical
    const regionMap = new Map<string, Region>()
    for (const region of regions) {
      regionMap.set(region.refName, region)
    }

    // Create a mock view object with the necessary properties
    const view: any = {
      bpPerPx,
      offsetPx,
      assemblyNames: [assemblyName],
      bpToPx: (arg: { refName: string; coord: number }) => {
        const { refName, coord } = arg
        const region = regionMap.get(refName)
        if (!region) {
          return undefined
        }
        // Calculate offset in pixels from start of region
        const bpOffset = coord - region.start
        const pxOffset = bpOffset / bpPerPx + (region.refName === regions[0]?.refName ? 0 : offsetPx)
        return { offsetPx: pxOffset }
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
          return calculateYOffsets(computedChains, params, view, featureHeight, height)
        }

        // Call the drawing function
        const { layoutHeight } = drawFeatsCore(
          ctx,
          params,
          view,
          asm,
          wrappedCalculateYOffsets,
        )
        return { layoutHeight }
      },
    )

    return result
  }
}
