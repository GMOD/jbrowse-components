import { forEachClippedBlock } from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DPerRegionRenderingBackend } from '@jbrowse/render-core/perRegionRenderingBackend'

import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
  getRowHeight,
} from './wiggleComponentUtils.ts'
import {
  drawDensity,
  drawLine,
  drawLineCenter,
  drawScatter,
  drawXYPlot,
} from './wiggleDrawFunctions.ts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingBackend,
} from '@jbrowse/wiggle-core'

// Pure draw entry point per agent-docs/reference/SVG_EXPORT.md. Paints
// line / density / scatter / xyplot per render type, one source per row.
function drawWiggleBlocks(
  ctx: Ctx2D,
  regions: ReadonlyMap<number, SourceRenderData[]>,
  blocks: RenderBlock[],
  state: WiggleGPURenderState,
) {
  const {
    canvasWidth,
    canvasHeight,
    renderingType,
    scaleType,
    domainY,
    numRows,
    scatterPointSize,
    lineWidth,
    origin,
  } = state
  // getRowHeight, not a bare divide: a source list that filters to empty (a
  // subtree filter naming nothing present) leaves numRows 0 while
  // buildSourceRenderData still falls back to the payload's sources, and
  // Infinity here propagates to NaN rect geometry.
  const rowHeight = getRowHeight(canvasHeight, numRows)

  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    canvasHeight,
    block => {
      const sources = regions.get(block.displayedRegionIndex)
      return sources && sources.length > 0 ? sources : undefined
    },
    (sources, block) => {
      for (const source of sources) {
        const rowTop = source.rowIndex * rowHeight
        const r = Math.round(source.color[0] * 255)
        const g = Math.round(source.color[1] * 255)
        const b = Math.round(source.color[2] * 255)
        const rgb = `rgb(${r},${g},${b})`
        const row = {
          ctx,
          source,
          block,
          rowHeight,
          rowTop,
          domainY,
          scaleType,
          origin,
        }

        switch (renderingType) {
          case RENDERING_TYPE_LINE:
            drawLine({ ...row, rgb, lineWidth })
            break
          case RENDERING_TYPE_LINE_CENTER:
            drawLineCenter({ ...row, rgb, lineWidth })
            break
          case RENDERING_TYPE_DENSITY:
            drawDensity({ ...row, r, g, b })
            break
          case RENDERING_TYPE_SCATTER:
            drawScatter({ ...row, rgb, pointSize: scatterPointSize })
            break
          default:
            drawXYPlot({ ...row, rgb })
        }
      }
    },
  )
}

// One-shot pure entry point used by SVG export per
// agent-docs/reference/SVG_EXPORT.md. On-screen uses the streamed per-region
// path via Canvas2DWiggleRenderer because rpcDataMap entries arrive
// incrementally.
export function drawWiggleToCtx<Data>(
  ctx: Ctx2D,
  sources: {
    rpcDataMap: ReadonlyMap<number, Data>
    encode: (data: Data) => SourceRenderData[]
  },
  blocks: RenderBlock[],
  state: WiggleGPURenderState,
) {
  const regions = new Map<number, SourceRenderData[]>()
  for (const [idx, data] of sources.rpcDataMap) {
    const encoded = sources.encode(data)
    if (encoded.length > 0) {
      regions.set(idx, encoded)
    }
  }
  drawWiggleBlocks(ctx, regions, blocks, state)
}

// Stateless on-screen backend. The encoded sources map lives in the
// per-region lifecycle closure (see installPerRegionLifecycle) and is
// passed to renderBlocks each frame.
export class Canvas2DWiggleRenderer
  extends Canvas2DPerRegionRenderingBackend<
    SourceRenderData[],
    WiggleGPURenderState
  >
  implements WiggleRenderingBackend
{
  protected draw(
    blocks: RenderBlock[],
    regions: ReadonlyMap<number, SourceRenderData[]>,
    state: WiggleGPURenderState,
  ) {
    drawWiggleBlocks(this.ctx, regions, blocks, state)
  }
}
