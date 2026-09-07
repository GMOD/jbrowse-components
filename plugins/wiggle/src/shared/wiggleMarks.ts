import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { getDpr } from '@jbrowse/render-core/canvas2dUtils'
import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'
import {
  RENDERING_TYPE_DENSITY,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
  RENDERING_TYPE_SCATTER,
} from '@jbrowse/wiggle-core'

import { densityRampLut } from './densityColorRamp.ts'
import * as wiggleShader from './shaders/wiggle.generated.ts'
import * as wiggleDensityShader from './shaders/wiggleDensity.generated.ts'
import * as wiggleLineShader from './shaders/wiggleLine.generated.ts'
import { getRowHeight, getRowTop } from './wiggleComponentUtils.ts'
import {
  drawDensity,
  drawLine,
  drawLineCenter,
  drawScatter,
  drawXYPlot,
} from './wiggleDrawFunctions.ts'
import { packFillInstances, packLineInstances } from './wiggleInstanceBuffer.ts'

import type { RowDraw } from './wiggleDrawFunctions.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { InstancePass } from '@jbrowse/render-core/instancePass'
import type { MarkFrame, MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'
import type { WiggleScaleType } from '@jbrowse/wiggle-core/normalize'

/**
 * Everything but the block geometry that both backends read, taken **off the
 * region's own layers** for `renderingType` and never off the render state.
 * The buffer carries only the neighbour fields the rendering it was encoded
 * for reads, so the shape drawing it has to be that same rendering or it reads
 * fields nobody wrote — and encode and render arrive through separate
 * autoruns, the render one first, so `state` can already name the rendering
 * the user just switched to while this region's buffer is still the previous
 * one. Drawing the previous plot for one frame is the correct stale. Empty
 * layers mean no buffer at all, so `state` is as good an answer as any.
 */
interface WiggleParams {
  renderingType: WiggleRenderingType
  scaleType: WiggleScaleType
  symlogConstant: number
  domainY: [number, number]
  numRows: number
  scatterPointSize: number
  lineWidth: number
  origin: number
  // Density's named-ramp table, resolved from a name on the render state: the
  // GPU samples these bytes as the density pass's texture and Canvas2D indexes
  // the same cached array. Never the instance buffer — the score→colour
  // mapping moving must not re-upload a byte.
  rampLut: Uint8Array | null
}

function wiggleParams(
  state: WiggleGPURenderState,
  sources: SourceRenderData[],
): WiggleParams {
  const renderingType = sources[0]?.renderingType ?? state.renderingType
  return {
    renderingType,
    scaleType: state.scaleType,
    symlogConstant: state.symlogConstant,
    domainY: state.domainY,
    numRows: state.numRows,
    scatterPointSize: state.scatterPointSize,
    lineWidth: state.lineWidth,
    origin: state.origin,
    rampLut:
      renderingType === RENDERING_TYPE_DENSITY
        ? densityRampLut(state.densityColorRamp)
        : null,
  }
}

function writeWiggleUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  frame: MarkFrame,
  p: WiggleParams,
) {
  // Any module's packer serves: the three entry shaders share
  // `wiggleCommon.slang`'s uniform block, so the generated `Uniforms` are one
  // block.
  wiggleShader.writeUniforms(scratch, {
    bpRangeX: bpRangeXTuple(clip, block.reversed),
    canvasHeight: frame.canvasHeight,
    scaleType: p.scaleType,
    symlogConstant: p.symlogConstant,
    renderingType: p.renderingType,
    numRows: p.numRows,
    domainYMin: p.domainY[0],
    domainYMax: p.domainY[1],
    // 'zero' uniform — MUST be 0.0, used by hp_to_clip_x for precision
    zero: 0,
    // CSS units, to match canvasHeight. `extendToMinWidthX` divides
    // `MIN_FILL_WIDTH_PX` by it to reach clip space, so a CSS width is what
    // makes the floor a stable 1.5 CSS px across DPRs rather than 1.5 DEVICE
    // px — and `WIGGLE_MIN_PX`, the Canvas2D floor, is that same generated
    // constant. `clip.scissorW`, therefore, and never `clip.pxW`.
    viewportWidth: clip.scissorW,
    scatterPointSize: p.scatterPointSize,
    lineWidth: p.lineWidth,
    origin: p.origin,
    // Screen density, so a fragment measuring a true CSS-px distance can size
    // its ramp to one OUTPUT pixel. `getDpr()` and not `clip.pxH /
    // canvasHeight`: past the backing-store clamp the two differ, and the ramp
    // wants the density of the screen the mark is read on.
    devicePixelRatio: getDpr(),
    densityRampLut: p.rampLut ? 1 : 0,
  })
}

function rgb255(source: SourceRenderData) {
  const [r, g, b] = source.color
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

function cssRgb(source: SourceRenderData) {
  const { r, g, b } = rgb255(source)
  return `rgb(${r},${g},${b})`
}

/**
 * One rendering family: its pass, the shared uniform write, and the painter
 * run once per source row.
 *
 * `draws` is the family gate both backends take, and it is the same decision
 * as the pass: a region whose layers are not this family declines the block
 * rather than drawing another family's painter over them.
 *
 * `getRowHeight`, not a bare divide: `makeWiggleRenderState` floors `numRows`
 * at 1 for the shader's sake, but the SVG export reaches the same painters
 * with a hand-built state, and an Infinity here would propagate to NaN rect
 * geometry.
 */
function wiggleShape(
  pass: InstancePass<SourceRenderData[]>,
  draws: (renderingType: WiggleRenderingType) => boolean,
  paint: (row: RowDraw, p: WiggleParams) => void,
): MarkShape<SourceRenderData[], WiggleParams> {
  return {
    id: pass.id,
    pass,
    writeUniforms: writeWiggleUniforms,
    paintsBlock: (_block, _frame, p) => draws(p.renderingType),
    paintBlock(ctx, sources, block, frame, p) {
      const rowHeight = getRowHeight(frame.canvasHeight, p.numRows)
      for (const source of sources) {
        paint(
          {
            ctx,
            source,
            block,
            rowHeight,
            rowTop: getRowTop(source.rowIndex, rowHeight),
            domainY: p.domainY,
            scaleType: p.scaleType,
            symlogConstant: p.symlogConstant,
            origin: p.origin,
          },
          p,
        )
      }
    },
  }
}

// xyplot and scatter, the two renderings the narrow five-word record serves,
// and the family anything unrecognized falls to — the default arm both
// backends have always had.
const fillShape = wiggleShape(
  {
    ...slangPass({ id: 'fill', mod: wiggleShader }),
    pack: packFillInstances,
  },
  type =>
    type !== RENDERING_TYPE_DENSITY &&
    type !== RENDERING_TYPE_LINE &&
    type !== RENDERING_TYPE_LINE_CENTER,
  (row, p) => {
    if (row.source.renderingType === RENDERING_TYPE_SCATTER) {
      drawScatter({
        ...row,
        rgb: cssRgb(row.source),
        pointSize: p.scatterPointSize,
      })
    } else {
      drawXYPlot({ ...row, rgb: cssRgb(row.source) })
    }
  },
)

const densityShape = wiggleShape(
  {
    ...slangPass({ id: 'density', mod: wiggleDensityShader }),
    pack: packFillInstances,
  },
  type => type === RENDERING_TYPE_DENSITY,
  (row, p) => {
    drawDensity({ ...row, ...rgb255(row.source), rampLut: p.rampLut })
  },
)

// The step line's vertex count is the shader's own — `vs_main` splits
// `SV_VertexID` by the same numbers — and it draws as 3 square-capped quad
// segments rather than a line list, whose width is hard-locked to 1px on both
// GPU HALs.
const lineShape = wiggleShape(
  {
    ...slangPass({
      id: 'line',
      mod: wiggleLineShader,
      verticesPerInstance: wiggleLineShader.STEP_LINE_VERTS,
    }),
    pack: packLineInstances,
  },
  type => type === RENDERING_TYPE_LINE,
  (row, p) => {
    drawLine({ ...row, rgb: cssRgb(row.source), lineWidth: p.lineWidth })
  },
)

// Premultiplied MAX blend so the analytic-AA ribbon's overlapping segments and
// caps union instead of accumulating into dark seams under src-over. Valid
// because the target clears to transparent black and only this pass draws in
// center-line mode. Stated on the pass rather than as a `//! blend:` on
// wiggleLine.slang, because the step line above shares that shader and blends
// the other way.
const lineCenterShape = wiggleShape(
  {
    ...slangPass({
      id: 'lineCenter',
      mod: wiggleLineShader,
      blendState: { op: 'max' },
    }),
    pack: packLineInstances,
  },
  type => type === RENDERING_TYPE_LINE_CENTER,
  (row, p) => {
    drawLineCenter({ ...row, rgb: cssRgb(row.source), lineWidth: p.lineWidth })
  },
)

const channels = (sources: SourceRenderData[]) => sources

const fill = defineMark({
  shape: fillShape,
  channels,
  params: wiggleParams,
})

const line = defineMark({
  shape: lineShape,
  channels,
  params: wiggleParams,
})

/**
 * The wiggle family as a mark list: one mark per rendering family over the
 * three hand-written shaders, and one uniform block behind all four, since
 * every entry shader imports `wiggleCommon.slang`'s.
 *
 * Two instance layouts, so two of the four marks carry the region's buffer and
 * the other two borrow it through `bufferOf`: density draws off the fill
 * record (`wiggleDensity.slang` declares the same struct) and the center line
 * off the step line's. Each packer returns empty for the renderings that
 * aren't its own, and an empty pack IS the release, so a region holds only the
 * layout its rendering actually draws.
 */
export const WIGGLE_MARKS = [
  fill,
  defineMark({
    shape: densityShape,
    channels,
    params: wiggleParams,
    bufferOf: fill,
    // Resolved off the render state, per pass: the named ramp is one 256×1
    // texture and a uniform flag, and 'default' names none, which binds the
    // inert table the backend keeps.
    texture: (state: WiggleGPURenderState) =>
      densityRampLut(state.densityColorRamp) ?? undefined,
  }),
  line,
  defineMark({
    shape: lineCenterShape,
    channels,
    params: wiggleParams,
    bufferOf: line,
  }),
]
