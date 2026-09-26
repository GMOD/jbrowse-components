import {
  CANVAS_SEAM_PX,
  makeBpMapper,
  spanLeft,
} from '@jbrowse/render-core/canvas2dUtils'
import { extendToMinWidthPx } from '@jbrowse/render-core/shaders/hpmath'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { createCanvas } from 'canvas'

import { WIGGLE_MIN_PX } from '../../util.ts'
import { makeDensityRgbStringFn } from '../getDensityColor.ts'
import { drawDensity } from '../wiggleDrawFunctions.ts'

import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

// Density writes `MIN_FILL_WIDTH_PX` into `rowRect`'s `minCellPx`, which the
// shape documents as what a caller whose marks do NOT tile writes. Reviews keep
// reading that as a bug against `MAF_SUBPIXEL_CELLS.md`, so the two halves of
// the answer are pinned here.
//
// On a tiling the floor changes no pixel: each quad grows off its own start
// edge, so the next bin's quad covers the growth, and the last quad covering a
// sample point is the bin containing it either way. That holds for any sample
// pattern, which is why both the one-sample and the 4x-MSAA arms are exact.
//
// The sparse arm is the case the floor is for, and the one that makes the two
// spellings distinguishable: a row of 0.3px marks with white between them
// carries a twentieth of a pixel of ink each.
const WIDTH = 400
const ROW_HEIGHT = 12
const COLOR = { r: 0, g: 0, b: 255 }
const DOMAIN: [number, number] = [0, 40]
const SUPERSAMPLE = 16

interface Bins {
  starts: number[]
  ends: number[]
  scores: number[]
  start: number
  end: number
  reversed: boolean
}

function bins({
  bpPerPx,
  keepEvery = 1,
  reversed = false,
}: {
  bpPerPx: number
  keepEvery?: number
  reversed?: boolean
}): Bins {
  const start = 20_000
  const end = start + WIDTH * bpPerPx
  const out: Bins = { starts: [], ends: [], scores: [], start, end, reversed }
  for (let bp = start; bp < end; bp += keepEvery) {
    const i = bp - start
    out.starts.push(bp)
    out.ends.push(bp + 1)
    out.scores.push(20 + 15 * Math.sin(i / 37) + ((i * 2654435761) >>> 24) / 64)
  }
  return out
}

function binColor(score: number) {
  const t = Math.min(1, Math.max(0, score / DOMAIN[1]))
  return [255 - 255 * t, 255 - 255 * t, 255] as const
}

// Every GPU rasteriser resolves a flat opaque quad the same way: a sample takes
// the colour of the last quad covering it. Only the coverage rule is modelled —
// the widening is the shader's own `extendToMinWidthPx`.
function gpuRow(
  b: Bins,
  { floorPx, samples, dpr }: { floorPx: number; samples: number; dpr: number },
) {
  const nPix = WIDTH * dpr
  const buf = new Float64Array(nPix * samples * 3).fill(255)
  const toX = makeBpMapper({
    start: b.start,
    end: b.end,
    screenStartPx: 0,
    screenEndPx: WIDTH,
    reversed: b.reversed,
  })
  for (let i = 0; i < b.starts.length; i++) {
    const x1 = toX(b.starts[i]!)
    const x2 = extendToMinWidthPx(x1, toX(b.ends[i]!), floorPx)
    const lo = Math.min(x1, x2)
    const hi = Math.max(x1, x2)
    const rgb = binColor(b.scores[i]!)
    for (
      let s = Math.max(0, Math.floor(lo * dpr) * samples);
      s < nPix * samples;
      s++
    ) {
      const p = Math.floor(s / samples)
      const sx = (p + ((s % samples) + 0.5) / samples) / dpr
      if (sx >= hi) {
        break
      }
      if (sx >= lo) {
        buf[s * 3] = rgb[0]
        buf[s * 3 + 1] = rgb[1]
        buf[s * 3 + 2] = rgb[2]
      }
    }
  }
  const out = new Float64Array(nPix * 3)
  for (let p = 0; p < nPix; p++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let s = 0; s < samples; s++) {
        sum += buf[(p * samples + s) * 3 + c]!
      }
      out[p * 3 + c] = sum / samples
    }
  }
  return out
}

function canvasRow(b: Bins, floorPx?: number) {
  const canvas = createCanvas(WIDTH, ROW_HEIGHT)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, WIDTH, ROW_HEIGHT)
  const n = b.starts.length
  const positions = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    positions[i * 2] = b.starts[i]!
    positions[i * 2 + 1] = b.ends[i]!
  }
  const block: RenderBlock = {
    start: b.start,
    end: b.end,
    screenStartPx: 0,
    screenEndPx: WIDTH,
    reversed: b.reversed,
    displayedRegionIndex: 0,
  }
  if (floorPx === undefined) {
    drawDensity({
      ctx: ctx as unknown as MarkContext2D,
      source: {
        featurePositions: positions,
        featureScores: Float32Array.from(b.scores),
        numFeatures: n,
      } as unknown as SourceRenderData,
      block,
      rowHeight: ROW_HEIGHT,
      rowTop: 0,
      domainY: DOMAIN,
      scaleType: 'linear' as never,
      symlogConstant: 1,
      origin: 0,
      pivot: 0,
      cuts: [],
      innerColors: [],
      rampLut: null,
      rampMid: undefined,
      ...COLOR,
    })
  } else {
    // drawDensity's own loop with the floor as a parameter, pinned against the
    // shipped call below so the no-floor arm is the same painter.
    const colorFn = makeDensityRgbStringFn(
      DOMAIN[0],
      DOMAIN[1],
      'linear' as never,
      COLOR.r,
      COLOR.g,
      COLOR.b,
    )
    const toX = makeBpMapper(block)
    for (let i = 0; i < n; i++) {
      const x1 = toX(positions[i * 2]!)
      const x2 = toX(positions[i * 2 + 1]!)
      const w = Math.max(floorPx, Math.abs(x2 - x1) + CANVAS_SEAM_PX)
      ctx.fillStyle = colorFn(b.scores[i]!)
      ctx.fillRect(
        spanLeft(x1, x2, w),
        rowBandOffsetPx(ROW_HEIGHT, 1),
        w,
        drawnRowHeightPx(ROW_HEIGHT, 1),
      )
    }
  }
  const img = ctx.getImageData(0, 0, WIDTH, ROW_HEIGHT)
  const y = Math.floor(ROW_HEIGHT / 2)
  const out = new Float64Array(WIDTH * 3)
  for (let p = 0; p < WIDTH; p++) {
    for (let c = 0; c < 3; c++) {
      out[p * 3 + c] = img.data[(y * WIDTH + p) * 4 + c]!
    }
  }
  return out
}

function downsample(row: Float64Array, factor: number) {
  const n = row.length / 3 / factor
  const out = new Float64Array(n * 3)
  for (let p = 0; p < n; p++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0
      for (let k = 0; k < factor; k++) {
        sum += row[(p * factor + k) * 3 + c]!
      }
      out[p * 3 + c] = sum / factor
    }
  }
  return out
}

// Ink, the density analogue of MAF_SUBPIXEL_CELLS' chroma: the ramp runs white
// to the track colour, so max-min over the channels is how much colour the row
// carries.
function ink(row: Float64Array) {
  let total = 0
  const n = row.length / 3
  for (let i = 0; i < n; i++) {
    const [r, g, b] = [row[i * 3]!, row[i * 3 + 1]!, row[i * 3 + 2]!]
    total += Math.max(r, g, b) - Math.min(r, g, b)
  }
  return total / n
}

function maxDiff(a: Float64Array, b: Float64Array) {
  let worst = 0
  for (let i = 0; i < a.length; i++) {
    worst = Math.max(worst, Math.abs(a[i]! - b[i]!))
  }
  return worst
}

const truth = (b: Bins) =>
  downsample(
    gpuRow(b, { floorPx: 0, samples: 1, dpr: SUPERSAMPLE }),
    SUPERSAMPLE,
  )

test.each([0.25, 0.325, 0.526, 1, 2])(
  'a floored tiling of %s px bins paints exactly what an unfloored one paints',
  bpPx => {
    for (const reversed of [false, true]) {
      for (const samples of [1, 4]) {
        const b = bins({ bpPerPx: 1 / bpPx, reversed })
        expect(
          maxDiff(
            gpuRow(b, { floorPx: WIGGLE_MIN_PX, samples, dpr: 1 }),
            gpuRow(b, { floorPx: 0, samples, dpr: 1 }),
          ),
        ).toBe(0)
      }
    }
  },
)

test('the floor adds no ink to a tiling on either backend', () => {
  const b = bins({ bpPerPx: 4 })
  const want = ink(truth(b))
  expect(
    ink(gpuRow(b, { floorPx: WIGGLE_MIN_PX, samples: 4, dpr: 1 })) - want,
  ).toBeLessThan(0.05)
  expect(Math.abs(ink(canvasRow(b)) - want)).toBeLessThan(1)
  expect(maxDiff(canvasRow(b, WIGGLE_MIN_PX), canvasRow(b))).toBe(0)
  expect(Math.abs(ink(canvasRow(b, 0)) - ink(canvasRow(b)))).toBeLessThan(1)
})

test('a sparse row is the case the floor is for, and it costs ink', () => {
  const b = bins({ bpPerPx: 3.25, keepEvery: 8 })
  const want = ink(truth(b))
  expect(want).toBeLessThan(20)
  expect(ink(gpuRow(b, { floorPx: 0, samples: 4, dpr: 1 }))).toBeCloseTo(
    want,
    0,
  )
  expect(
    ink(gpuRow(b, { floorPx: WIGGLE_MIN_PX, samples: 4, dpr: 1 })),
  ).toBeGreaterThan(want * 4)
  expect(ink(canvasRow(b))).toBeGreaterThan(want * 4)
})
