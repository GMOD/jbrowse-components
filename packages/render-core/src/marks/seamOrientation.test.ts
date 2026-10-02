import { createCanvas } from 'canvas'

import { barMark } from './barMark.ts'
import { spanMark } from './spanMark.ts'

import type { BarChannels } from './barMark.ts'
import type { SpanChannels } from './spanMark.ts'

const W = 997
const H = 40
const PALETTE = [0xff3643f4, 0xfff39621, 0xff50af4c, 0xff3b98ff]

function rgbOf(abgr: number) {
  return [abgr & 255, (abgr >>> 8) & 255, (abgr >>> 16) & 255]
}

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

type Runs = ReturnType<typeof tilingRuns>

function tilingRuns(
  spanBp: number,
  maxRun: number,
  seed: number,
  mono = false,
) {
  const rnd = lcg(seed)
  const x: number[] = []
  const x2: number[] = []
  const color: number[] = []
  const y: number[] = []
  let at = 0
  let prev = -1
  while (at < spanBp) {
    const len = Math.min(spanBp - at, 1 + Math.floor(rnd() * maxRun))
    let c = Math.floor(rnd() * PALETTE.length)
    if (!mono && c === prev) {
      c = (c + 1) % PALETTE.length
    }
    prev = c
    x.push(at)
    x2.push(at + len)
    color.push(PALETTE[mono ? 0 : c]!)
    y.push(0.2 + 0.8 * rnd())
    at += len
  }
  return { x, x2, color, y, count: x.length }
}

function block(spanBp: number, reversed: boolean) {
  return {
    displayedRegionIndex: 0,
    start: 0,
    end: spanBp,
    screenStartPx: 0,
    screenEndPx: W,
    reversed,
  }
}

type Ctx = CanvasRenderingContext2D

function paint(fn: (ctx: Ctx) => void) {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d') as unknown as Ctx
  fn(ctx)
  return ctx.getImageData(0, 0, W, H).data
}

function truthAt(runs: Runs, spanBp: number, reversed: boolean, px: number) {
  const c = px + 0.5
  const bp = reversed ? ((W - c) / W) * spanBp : (c / W) * spanBp
  for (let i = 0; i < runs.count; i++) {
    if (bp >= runs.x[i]! && bp < runs.x2[i]!) {
      return i
    }
  }
  return -1
}

function pxDiff(img: Uint8ClampedArray, o: number, want: number[]) {
  return Math.max(...want.map((v, k) => Math.abs(v - img[o + k]!)))
}

const frame = { canvasWidth: W, canvasHeight: H }

const ZOOMS: [string, number, number][] = [
  ['4 px/bp, runs 1-6bp', 250, 6],
  ['1.37 px/bp, runs 1-6bp', 727, 6],
  ['0.33 px/bp, runs 1-6bp', 3000, 6],
  ['0.33 px/bp, runs 1-30bp', 3000, 30],
]

const spanParams = {
  rowHeight: H,
  rowProportion: 1,
  minWidthPx: 0,
  seamPx: 0.4,
  scrollTop: 0,
}

function spanChannels(r: Runs): SpanChannels {
  return {
    x: Uint32Array.from(r.x),
    x2: Uint32Array.from(r.x2),
    row: new Uint32Array(r.count),
    color: Uint32Array.from(r.color),
    count: r.count,
  }
}

// Percent of pixels missing the pixel-centre truth by more than 24/255.
function spanMiss(spanBp: number, maxRun: number, reversed: boolean) {
  const runs = tilingRuns(spanBp, maxRun, 7)
  const img = paint(ctx => {
    spanMark.paintBlock(
      ctx,
      spanChannels(runs),
      block(spanBp, reversed),
      frame,
      spanParams,
    )
  })
  let bad = 0
  const line = H >> 1
  for (let px = 0; px < W; px++) {
    const i = truthAt(runs, spanBp, reversed, px)
    const want = i < 0 ? [0, 0, 0, 0] : [...rgbOf(runs.color[i]!), 255]
    if (pxDiff(img, (line * W + px) * 4, want) > 24) {
      bad++
    }
  }
  return (100 * bad) / W
}

function barChannels(r: Runs): BarChannels {
  return {
    x: Uint32Array.from(r.x),
    x2: Uint32Array.from(r.x2),
    y: Float32Array.from(r.y),
    color: Uint32Array.from(r.color),
    count: r.count,
  }
}

const barParams = {
  domain: [0, 1] as [number, number],
  origin: 0,
  minWidthPx: 0,
  seamPx: 0.8,
  rowHeight: H,
}

function barMiss(spanBp: number, maxRun: number, reversed: boolean) {
  const runs = tilingRuns(spanBp, maxRun, 11)
  const img = paint(ctx => {
    barMark.paintBlock(
      ctx,
      barChannels(runs),
      block(spanBp, reversed),
      frame,
      barParams,
    )
  })
  let bad = 0
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = truthAt(runs, spanBp, reversed, px)
      const inBar = i >= 0 && py + 0.5 >= H - runs.y[i]! * H
      const want = inBar ? [...rgbOf(runs.color[i]!), 255] : [0, 0, 0, 0]
      if (pxDiff(img, (py * W + px) * 4, want) > 24) {
        bad++
      }
    }
  }
  return (100 * bad) / (W * H)
}

// Sub-pixel runs miss the truth on both orientations; reversing the block
// must not add to it, which it does when the seam lands on the neighbour
// already painted.
test.each(ZOOMS)(
  'a reversed span tiles as well as a forward one, %s',
  (_, spanBp, maxRun) => {
    expect(
      spanMiss(spanBp, maxRun, true) - spanMiss(spanBp, maxRun, false),
    ).toBeLessThan(0.5)
  },
)

test.each(ZOOMS)(
  'a reversed bar tiles as well as a forward one, %s',
  (_, spanBp, maxRun) => {
    expect(
      barMiss(spanBp, maxRun, true) - barMiss(spanBp, maxRun, false),
    ).toBeLessThan(0.5)
  },
)
