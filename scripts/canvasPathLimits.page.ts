import { pointMark } from '../packages/render-core/src/marks/pointMark.ts'
import { GLYPH_DISC } from '../packages/render-core/src/shaders/pointMark.consts.generated.ts'
import { RENDERING_TYPE_LINE } from '../packages/wiggle-core/src/renderingBackendTypes.ts'
import { drawDotplotInstances } from '../plugins/dotplot-view/src/DotplotDisplay/drawDotplot.ts'
import {
  drawLine,
  drawLineCenter,
  drawScatter,
  drawWhiskerBand,
} from '../plugins/wiggle/src/shared/wiggleDrawFunctions.ts'

import type { MarkContext2D } from '../packages/render-core/src/marks/types.ts'
import type { SourceRenderData } from '../packages/wiggle-core/src/renderingBackendTypes.ts'
import type { DotplotGeometryData } from '../plugins/dotplot-view/src/DotplotDisplay/dotplotRenderingBackendTypes.ts'

const W = 1000
const H = 200
const LEFT = 10
const RIGHT = W - 10
const RED = 0xff0000ff

export interface CaseResult {
  name: string
  shapes: number
  unlitColumns: number
}

type Painter = (ctx: MarkContext2D, n: number) => void

function unlitColumns(paint: Painter, n: number) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  document.body.replaceChildren(canvas)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'red'
  ctx.strokeStyle = 'red'
  paint(ctx, n)
  const { data } = ctx.getImageData(0, 0, W, H)
  let unlit = 0
  for (let x = LEFT + 2; x < RIGHT - 2; x++) {
    let lit = false
    for (let y = 0; y < H && !lit; y++) {
      lit = data[(y * W + x) * 4 + 3]! > 0
    }
    if (!lit) {
      unlit++
    }
  }
  return unlit
}

const xAt = (i: number, n: number) => LEFT + ((i + 0.5) / n) * (RIGHT - LEFT)
const yAt = (i: number) => H / 2 + (H / 3) * Math.sin(i / 50)

const block = (n: number) => ({
  displayedRegionIndex: 0,
  start: 0,
  end: n,
  screenStartPx: LEFT,
  screenEndPx: RIGHT,
  reversed: false,
})

function pointPainter(glyph: number, diameterPx: number): Painter {
  return (ctx, n) => {
    pointMark.paintBlock(
      ctx,
      {
        x: Uint32Array.from({ length: n }, (_, i) => i),
        x2: Uint32Array.from({ length: n }, (_, i) => i + 1),
        y: Float32Array.from({ length: n }, (_, i) => Math.sin(i / 50)),
        glyph: new Uint8Array(n).fill(glyph),
        color: new Uint32Array(n).fill(RED),
        count: n,
      },
      block(n),
      { canvasWidth: W, canvasHeight: H },
      { domain: [-1.2, 1.2], diameterPx },
    )
  }
}

function wiggleSource(n: number): SourceRenderData {
  return {
    featurePositions: Uint32Array.from({ length: 2 * n }, (_, j) =>
      Math.floor((j + 1) / 2),
    ),
    featureScores: Float32Array.from({ length: n }, (_, i) => Math.sin(i / 50)),
    numFeatures: n,
    color: [255, 0, 0],
    rowIndex: 0,
    renderingType: RENDERING_TYPE_LINE,
  }
}

function wiggleRow(ctx: MarkContext2D, n: number) {
  return {
    ctx,
    source: wiggleSource(n),
    block: block(n),
    rowHeight: H,
    rowTop: 0,
    domainY: [-1.2, 1.2] as [number, number],
    scaleType: 0 as const,
    symlogConstant: 1,
    origin: 0,
    pivot: 0,
    cuts: [0],
    innerColors: [],
    rampLut: null,
    rampMid: undefined,
    rgb: 'red',
    negRgb: 'blue',
  }
}

function dotplotGeometry(n: number): DotplotGeometryData {
  const x1 = Float64Array.from({ length: n }, (_, i) => xAt(i, n))
  const y1 = Float64Array.from({ length: n }, (_, i) => yAt(i))
  return {
    x1,
    y1,
    x2: x1.map(x => x + 2),
    y2: y1.map(y => y + 2),
    instanceFeatureIdx: new Uint32Array(n),
    segmentOps: new Uint8Array(n),
    instanceCount: n,
    baseH: 0,
    baseV: 0,
    colors: new Uint32Array(n).fill(RED),
  }
}

const control: Painter = (ctx, n) => {
  ctx.beginPath()
  for (let i = 0; i < n; i++) {
    const x = xAt(i, n)
    const y = yAt(i)
    ctx.moveTo(x + 2, y)
    ctx.arc(x, y, 2, 0, Math.PI * 2)
  }
  ctx.fill()
}

const cases: [string, number, Painter][] = [
  ['pointMark disc (arc)', 200_000, pointPainter(GLYPH_DISC, 5)],
  ['pointMark square (rect)', 500_000, pointPainter(GLYPH_DISC, 2)],
  [
    'wiggle scatter',
    200_000,
    (ctx, n) => {
      drawScatter({ ...wiggleRow(ctx, n), diameterPx: 5 })
    },
  ],
  [
    'wiggle line',
    1_000_000,
    (ctx, n) => {
      drawLine({ ...wiggleRow(ctx, n), lineWidth: 1 })
    },
  ],
  [
    'wiggle linecenter',
    2_000_000,
    (ctx, n) => {
      drawLineCenter({ ...wiggleRow(ctx, n), lineWidth: 1 })
    },
  ],
  [
    'wiggle whiskers band',
    1_000_000,
    (ctx, n) => {
      const row = wiggleRow(ctx, n)
      drawWhiskerBand({
        ...row,
        source: {
          ...row.source,
          negColor: [0, 0, 255],
          band: { minScores: row.source.featureScores.map(v => v - 0.2) },
        },
        interpolated: false,
      })
    },
  ],
  [
    'dotplot segments',
    1_000_000,
    (ctx, n) => {
      drawDotplotInstances(ctx, dotplotGeometry(n), {
        viewBpH: 0,
        bpPerPxHInv: 1,
        viewBpV: 0,
        bpPerPxVInv: 1,
        viewWidth: W,
        viewHeight: H,
        lineWidth: 1,
        alpha: 1,
      })
    },
  ],
]

declare global {
  interface Window {
    canvasPathCaseCount: number
    runCanvasPathControl: () => number
    runCanvasPathCase: (i: number) => CaseResult
  }
}

window.canvasPathCaseCount = cases.length
window.runCanvasPathControl = () => unlitColumns(control, 200_000)
window.runCanvasPathCase = i => {
  const [name, shapes, paint] = cases[i]!
  return { name, shapes, unlitColumns: unlitColumns(paint, shapes) }
}
