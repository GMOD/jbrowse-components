/* eslint-disable no-console */
// What density's `MIN_FILL_WIDTH_PX` floor does to a row of sub-pixel bins, on
// real BigWig records. Backs `agent-docs/measurements/density-subpixel-floor.json`.
//
//   node --experimental-transform-types \
//     plugins/wiggle/benches/densitySubpixelFloor.ts \
//     --file=test_data/volvox/volvox-sorted.bam.coverage.bw \
//     --refName=ctgA --start=20000 --bpPerPx=3.25
//
// The ground truth is `MAF_SUBPIXEL_CELLS.md`'s: the same geometry with nothing
// floored, supersampled and box-downsampled, which is the bp-weighted mix a
// pixel should hold. A CSS-px floor does not shrink away at high dpr the way
// MAF's device-px one did, so the supersampled arm is the UNFLOORED geometry
// rather than the shipped rule.
//
// The GPU arms model one rule — a sample takes the colour of the last quad
// covering it — because the quads are flat and opaque. `densityMinWidth.test.ts`
// pins the property the arms are here to price; a real-GPU capture would only
// re-take these same numbers.
import { BigWig } from '@gmod/bbi'
import {
  CANVAS_SEAM_PX,
  makeBpMapper,
  spanLeft,
} from '@jbrowse/render-core/canvas2dUtils'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { createCanvas } from 'canvas'

import { makeDensityRgbStringFn } from '../src/shared/getDensityColor.ts'
import { drawDensity } from '../src/shared/wiggleDrawFunctions.ts'
import { WIGGLE_MIN_PX } from '../src/util.ts'

import type { MarkContext2D } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

const args = new Map(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k!, v ?? '']
  }),
)
const file =
  args.get('file') ?? 'test_data/volvox/volvox-sorted.bam.coverage.bw'
const refName = args.get('refName') ?? 'ctgA'
const start = Number(args.get('start') ?? 20_000)
const bpPerPx = Number(args.get('bpPerPx') ?? 3.25)
const WIDTH = Number(args.get('screenPx') ?? 1000)
const KEEP_EVERY = Number(args.get('sparseEvery') ?? 8)

const ROW_HEIGHT = 20
const COLOR = { r: 0, g: 0, b: 255 }
const SUPERSAMPLE = 16

const bw = new BigWig({ path: file })
await bw.getHeader()
const end = start + WIDTH * bpPerPx
const raw = (await bw.getFeatures(refName, start, end, { basesPerSpan: 1e-6 }))
  .filter(f => f.start >= start && f.start < end)
  .sort((a, b) => a.start - b.start)

const domainY: [number, number] = [
  0,
  Math.max(...raw.map(f => f.score ?? 0)) * 1.05,
]

interface Scene {
  name: string
  feats: { start: number; end: number; score: number }[]
}

const scenes: Scene[] = [
  {
    name: `tiling, ${((raw[0]!.end - raw[0]!.start) / bpPerPx).toFixed(3)} px bins`,
    feats: raw.map(f => ({ start: f.start, end: f.end, score: f.score ?? 0 })),
  },
  {
    name: `sparse, every ${KEEP_EVERY}th bin kept`,
    feats: raw
      .filter((_, i) => i % KEEP_EVERY === 0)
      .map(f => ({ start: f.start, end: f.end, score: f.score ?? 0 })),
  },
]

const block: RenderBlock = {
  start,
  end,
  screenStartPx: 0,
  screenEndPx: WIDTH,
  reversed: false,
  displayedRegionIndex: 0,
}

const colorFn = makeDensityRgbStringFn(
  domainY[0],
  domainY[1],
  'linear' as never,
  COLOR.r,
  COLOR.g,
  COLOR.b,
)

function gpuRow(
  scene: Scene,
  { floorPx, samples, dpr }: { floorPx: number; samples: number; dpr: number },
) {
  const nPix = WIDTH * dpr
  const buf = new Float64Array(nPix * samples * 3).fill(255)
  const toX = makeBpMapper(block)
  for (const f of scene.feats) {
    const x1 = toX(f.start)
    const x2 = Math.max(toX(f.end), x1 + floorPx)
    const [r, g, b] = colorFn(f.score).slice(4, -1).split(',').map(Number) as [
      number,
      number,
      number,
    ]
    for (let p = Math.max(0, Math.floor(x1 * dpr)); p < nPix; p++) {
      if (p / dpr >= x2) {
        break
      }
      for (let s = 0; s < samples; s++) {
        const sx = (p + (s + 0.5) / samples) / dpr
        if (sx >= x1 && sx < x2) {
          buf[(p * samples + s) * 3] = r
          buf[(p * samples + s) * 3 + 1] = g
          buf[(p * samples + s) * 3 + 2] = b
        }
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

function canvasRow(scene: Scene, floorPx?: number) {
  const canvas = createCanvas(WIDTH, ROW_HEIGHT)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, WIDTH, ROW_HEIGHT)
  const n = scene.feats.length
  const positions = new Uint32Array(n * 2)
  const scores = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    positions[i * 2] = scene.feats[i]!.start
    positions[i * 2 + 1] = scene.feats[i]!.end
    scores[i] = scene.feats[i]!.score
  }
  if (floorPx === undefined) {
    drawDensity({
      ctx: ctx as unknown as MarkContext2D,
      source: {
        featurePositions: positions,
        featureScores: scores,
        numFeatures: n,
      } as unknown as SourceRenderData,
      block,
      rowHeight: ROW_HEIGHT,
      rowTop: 0,
      domainY,
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
    const toX = makeBpMapper(block)
    for (let i = 0; i < n; i++) {
      const x1 = toX(positions[i * 2]!)
      const x2 = toX(positions[i * 2 + 1]!)
      const w = Math.max(floorPx, Math.abs(x2 - x1) + CANVAS_SEAM_PX)
      ctx.fillStyle = colorFn(scores[i]!)
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

function ink(row: Float64Array) {
  let total = 0
  const n = row.length / 3
  for (let i = 0; i < n; i++) {
    total +=
      Math.max(row[i * 3]!, row[i * 3 + 1]!, row[i * 3 + 2]!) -
      Math.min(row[i * 3]!, row[i * 3 + 1]!, row[i * 3 + 2]!)
  }
  return +(total / n).toFixed(2)
}

function compare(a: Float64Array, b: Float64Array) {
  const n = a.length / 3
  let sum = 0
  let differing = 0
  for (let i = 0; i < n; i++) {
    const d =
      Math.abs(a[i * 3]! - b[i * 3]!) +
      Math.abs(a[i * 3 + 1]! - b[i * 3 + 1]!) +
      Math.abs(a[i * 3 + 2]! - b[i * 3 + 2]!)
    sum += d / 3
    if (d > 30) {
      differing++
    }
  }
  return {
    dist: +(sum / n).toFixed(2),
    pctDiffering: +((differing / n) * 100).toFixed(1),
  }
}

const arms = [
  ['GPU floored 1.5px, 4x MSAA (shipped)', () => WIGGLE_MIN_PX, 4],
  ['GPU no floor, 4x MSAA', () => 0, 4],
  ['GPU floored 1.5px, 1 sample', () => WIGGLE_MIN_PX, 1],
  ['GPU no floor, 1 sample', () => 0, 1],
] as const

for (const scene of scenes) {
  const truth = downsample(
    gpuRow(scene, { floorPx: 0, samples: 1, dpr: SUPERSAMPLE }),
    SUPERSAMPLE,
  )
  console.log(
    `\n== ${scene.name} == ${scene.feats.length} bins over ${WIDTH}px, truth ink ${ink(truth)}`,
  )
  for (const [label, floor, samples] of arms) {
    const row = gpuRow(scene, { floorPx: floor(), samples, dpr: 1 })
    const c = compare(row, truth)
    console.log(
      `${label.padEnd(38)} dist ${String(c.dist).padStart(6)}  >30 ${String(c.pctDiffering).padStart(5)}%  ink ${ink(row)}`,
    )
  }
  for (const [label, floorPx] of [
    ['Canvas2D floored (shipped)', undefined],
    ['Canvas2D no floor (seam only)', 0],
  ] as const) {
    const row = canvasRow(scene, floorPx)
    const c = compare(row, truth)
    console.log(
      `${label.padEnd(38)} dist ${String(c.dist).padStart(6)}  >30 ${String(c.pctDiffering).padStart(5)}%  ink ${ink(row)}`,
    )
  }
}
