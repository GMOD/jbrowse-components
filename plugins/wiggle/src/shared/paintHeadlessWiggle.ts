import { buildRenderBlocks } from '@jbrowse/core/gpu/renderBlock'
import { paintLayer } from '@jbrowse/core/util/paintLayer'

import {
  Canvas2DWiggleRenderer,
  drawWiggleBlocks,
} from './Canvas2DWiggleRenderer.ts'

import type {
  SourceRenderData,
  WiggleGPURenderState,
} from './wiggleBackendTypes.ts'
import type {
  ExportSvgDisplayOptions,
  LinearGenomeViewModel,
} from '@jbrowse/plugin-linear-genome-view'

/**
 * Headless SVG-export entry point shared by Linear and Multi wiggle. Drives
 * the same drawWiggleBlocks pipeline used on-screen — encode each region's
 * data into SourceRenderData[], upload to a canvas-less Canvas2DWiggleRenderer,
 * then paint via paintLayer (rasterized PNG or SvgCanvas).
 */
export function paintHeadlessWiggle<Data>({
  view,
  height,
  rpcDataMap,
  encode,
  renderState,
  opts,
}: {
  view: LinearGenomeViewModel
  height: number
  rpcDataMap: ReadonlyMap<number, Data>
  encode: (data: Data) => SourceRenderData[]
  renderState: WiggleGPURenderState
  opts: ExportSvgDisplayOptions | undefined
}) {
  const renderer = new Canvas2DWiggleRenderer(null)
  for (const [displayedRegionIndex, data] of rpcDataMap) {
    renderer.uploadRegion(displayedRegionIndex, encode(data))
  }
  const totalWidth = view.totalWidthPx
  const renderBlocks = buildRenderBlocks(view.visibleRegions)
  const state = {
    ...renderState,
    canvasWidth: totalWidth,
    canvasHeight: height,
  }
  return paintLayer(totalWidth, height, opts, ctx => {
    drawWiggleBlocks(ctx, renderer.getRegions(), renderBlocks, state)
  })
}
