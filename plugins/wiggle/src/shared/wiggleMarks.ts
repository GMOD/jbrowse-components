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

import { rampMidNorm } from './getDensityColor.ts'
import * as wiggleShader from './shaders/wiggle.generated.ts'
import * as wiggleBandShader from './shaders/wiggleBand.generated.ts'
import * as wiggleDensityShader from './shaders/wiggleDensity.generated.ts'
import * as wiggleLineShader from './shaders/wiggleLine.generated.ts'
import * as wiggleLineCenterShader from './shaders/wiggleLineCenter.generated.ts'
import { getRowHeight, getRowTop } from './wiggleComponentUtils.ts'
import {
  drawDensity,
  drawLine,
  drawLineCenter,
  drawScatter,
  drawWhiskerBand,
  drawXYPlot,
} from './wiggleDrawFunctions.ts'
import {
  packBandInstances,
  packFillInstances,
  packLineCenterInstances,
  packLineInstances,
} from './wiggleInstanceBuffer.ts'

import type { RowDraw } from './wiggleDrawFunctions.ts'
import type { BlockClipResult } from '@jbrowse/render-core/blockClipUtils'
import type { InstancePass } from '@jbrowse/render-core/instancePass'
import type { MarkFrame, MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'
import type {
  SourceRenderData,
  WiggleGPURenderState,
  WiggleRenderingType,
} from '@jbrowse/wiggle-core'

/**
 * Everything but the block geometry that both backends read, taken **off the
 * region's own layers** for `renderingType` and never off the render state.
 * Each record carries only the fields its own rendering reads, so the shape
 * drawing a buffer has to be the rendering it was encoded for or it reads past
 * the end of its instances — and encode and render arrive through separate
 * autoruns, the render one first, so `state` can already name the rendering
 * the user just switched to while this region's buffer is still the previous
 * one. Drawing the previous plot for one frame is the correct stale. Empty
 * layers mean no buffer at all, so `state` is as good an answer as any.
 */
interface WiggleParams {
  renderingType: WiggleRenderingType
  scaleType: ScaleTypeCode
  symlogConstant: number
  domainY: [number, number]
  numRows: number
  scatterPointSize: number
  lineWidth: number
  origin: number
  pivot: number
  cuts: number[]
  innerColors: [number, number, number][]
  rampMid: number | undefined
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
    pivot: state.pivot,
    cuts: state.cuts,
    innerColors: state.innerColors,
    rampMid: state.rampMid,
    rampLut:
      renderingType === RENDERING_TYPE_DENSITY ? (state.rampLut ?? null) : null,
  }
}

function writeWiggleUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  frame: MarkFrame,
  p: WiggleParams,
) {
  // Any module's packer serves: the five entry shaders share
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
    pivot: p.pivot,
    rampMidNorm: rampMidNorm(
      p.domainY[0],
      p.domainY[1],
      p.scaleType,
      p.rampMid,
      p.symlogConstant,
    ),
    // Screen density, so a fragment measuring a true CSS-px distance can size
    // its ramp to one OUTPUT pixel. `getDpr()` and not `clip.pxH /
    // canvasHeight`: past the backing-store clamp the two differ, and the ramp
    // wants the density of the screen the mark is read on.
    devicePixelRatio: getDpr(),
    densityRampLut: p.rampLut ? 1 : 0,
    numCuts: p.cuts.length,
    cuts: [cutQuad(p.cuts, 0), cutQuad(p.cuts, 4)],
    innerColor: [
      innerRgba(p, 0),
      innerRgba(p, 1),
      innerRgba(p, 2),
      innerRgba(p, 3),
      innerRgba(p, 4),
      innerRgba(p, 5),
      innerRgba(p, 6),
    ],
  })
}

function innerRgba(
  p: WiggleParams,
  i: number,
): [number, number, number, number] {
  const [r, g, b] = p.innerColors[i] ?? [0, 0, 0]
  return [r, g, b, 1]
}

function cutQuad(
  cuts: number[],
  from: number,
): [number, number, number, number] {
  return [
    cuts[from] ?? 0,
    cuts[from + 1] ?? 0,
    cuts[from + 2] ?? 0,
    cuts[from + 3] ?? 0,
  ]
}

function rgb255(source: SourceRenderData) {
  const [r, g, b] = source.color
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  }
}

function rgbCss([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

function cssRgb(source: SourceRenderData) {
  return rgbCss(source.color)
}

function lineColors(source: SourceRenderData) {
  const rgb = cssRgb(source)
  return {
    rgb,
    negRgb: source.negColor
      ? cssRgb({ ...source, color: source.negColor })
      : rgb,
  }
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
            pivot: p.pivot,
            cuts: p.cuts,
            innerColors: p.innerColors,
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
    drawDensity({
      ...row,
      ...rgb255(row.source),
      rampLut: p.rampLut,
      rampMid: p.rampMid,
    })
  },
)

const isLineFamily = (type: WiggleRenderingType) =>
  type === RENDERING_TYPE_LINE || type === RENDERING_TYPE_LINE_CENTER

// The GPU draws the band after the lines and composites it behind them.
// MarkContext2D exposes no compositing operator, so on Canvas2D the line marks
// paint band layers, which sort ahead of every line.
const bandShape = wiggleShape(
  {
    ...slangPass({ id: 'band', mod: wiggleBandShader }),
    pack: packBandInstances,
  },
  isLineFamily,
  () => {},
)

// Three square-capped quad segments per feature rather than a line list, whose
// width is hard-locked to 1px on both GPU HALs.
const lineShape = wiggleShape(
  {
    ...slangPass({ id: 'line', mod: wiggleLineShader }),
    pack: packLineInstances,
  },
  type => type === RENDERING_TYPE_LINE,
  (row, p) => {
    if (row.source.band) {
      drawWhiskerBand({ ...row, interpolated: false })
    } else {
      drawLine({ ...row, ...lineColors(row.source), lineWidth: p.lineWidth })
    }
  },
)

const lineCenterShape = wiggleShape(
  {
    ...slangPass({ id: 'lineCenter', mod: wiggleLineCenterShader }),
    pack: packLineCenterInstances,
  },
  type => type === RENDERING_TYPE_LINE_CENTER,
  (row, p) => {
    if (row.source.band) {
      drawWhiskerBand({ ...row, interpolated: true })
    } else {
      drawLineCenter({
        ...row,
        ...lineColors(row.source),
        lineWidth: p.lineWidth,
      })
    }
  },
)

const channels = (sources: SourceRenderData[]) => sources

const fill = defineMark({
  shape: fillShape,
  channels,
  params: wiggleParams,
})

/**
 * The wiggle family as a mark list: one mark per hand-written shader, and one
 * uniform block behind all five, since every entry shader imports
 * `wiggleCommon.slang`'s.
 *
 * Four instance layouts, so four of the five marks carry the region's buffer
 * and density borrows the fill record through `bufferOf`
 * (`wiggleDensity.slang` declares the same struct). Each packer returns empty
 * for layers that aren't its own, and an empty pack IS the release, so a
 * region holds only the layouts its rendering actually draws. The band draws
 * last, behind the lines already in the target.
 */
export const WIGGLE_MARKS = [
  fill,
  defineMark({
    shape: densityShape,
    channels,
    params: wiggleParams,
    bufferOf: fill,
    // Off the render state, per pass: a declared ramp is one 256×1 texture
    // and a uniform flag, and no ramp binds the inert table the backend keeps.
    texture: (state: WiggleGPURenderState) => state.rampLut,
  }),
  defineMark({
    shape: lineShape,
    channels,
    params: wiggleParams,
  }),
  defineMark({
    shape: lineCenterShape,
    channels,
    params: wiggleParams,
  }),
  defineMark({
    shape: bandShape,
    channels: sources => (sources.some(s => s.band) ? sources : undefined),
    params: wiggleParams,
  }),
]
