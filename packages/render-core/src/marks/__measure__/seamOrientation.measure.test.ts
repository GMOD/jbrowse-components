import { createCanvas } from 'canvas'

import { barMark } from '../barMark.ts'
import { spanMark } from '../spanMark.ts'

import type { BarChannels } from '../barMark.ts'
import type { SpanChannels } from '../spanMark.ts'

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

function leftSeamCtx(ctx: Ctx, seam: number): Ctx {
  return new Proxy(ctx, {
    get(t, k) {
      if (k === 'fillRect') {
        return (x: number, y: number, w: number, h: number) => {
          t.fillRect(x - seam, y, w, h)
        }
      }
      const v = Reflect.get(t, k) as unknown
      return typeof v === 'function' ? v.bind(t) : v
    },
    set(t, k, v) {
      return Reflect.set(t, k, v)
    },
  })
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

const rows: string[] = []

afterAll(() => {
  console.log(rows.join('\n'))
})

const spanParams = (seamPx: number) => ({
  rowHeight: H,
  rowProportion: 1,
  minWidthPx: 0,
  seamPx,
  scrollTop: 0,
})

function spanChannels(r: Runs): SpanChannels {
  return {
    x: Uint32Array.from(r.x),
    x2: Uint32Array.from(r.x2),
    row: new Uint32Array(r.count),
    color: Uint32Array.from(r.color),
    count: r.count,
  }
}

// Fraction of the scanline whose pixel misses the pixel-centre truth by more
// than 24/255 on any channel, and the fraction showing background (a hairline).
function spanDiff(
  img: Uint8ClampedArray,
  runs: Runs,
  spanBp: number,
  reversed: boolean,
) {
  let bad = 0
  let holes = 0
  const line = H >> 1
  for (let px = 0; px < W; px++) {
    const i = truthAt(runs, spanBp, reversed, px)
    const want = i < 0 ? [0, 0, 0, 0] : [...rgbOf(runs.color[i]!), 255]
    const o = (line * W + px) * 4
    if (pxDiff(img, o, want) > 24) {
      bad++
    }
    if (img[o + 3]! < 250) {
      holes++
    }
  }
  return `${((100 * bad) / W).toFixed(1)}% off, ${holes} px alpha<250`
}

test.each(ZOOMS)('span seam, %s', (label, spanBp, maxRun) => {
  const runs = tilingRuns(spanBp, maxRun, 7)
  const ch = spanChannels(runs)
  const out: string[] = []
  for (const reversed of [false, true]) {
    const b = block(spanBp, reversed)
    const variants: [string, Uint8ClampedArray][] = [
      [
        'core, seam 0.4 right',
        paint(ctx => {
          spanMark.paintBlock(ctx, ch, b, frame, spanParams(0.4))
        }),
      ],
      [
        'seam toward next painted',
        paint(ctx => {
          spanMark.paintBlock(
            reversed ? leftSeamCtx(ctx, 0.4) : ctx,
            ch,
            b,
            frame,
            spanParams(0.4),
          )
        }),
      ],
      [
        'no seam',
        paint(ctx => {
          spanMark.paintBlock(ctx, ch, b, frame, spanParams(0))
        }),
      ],
    ]
    for (const [name, img] of variants) {
      out.push(
        `${reversed ? 'rev' : 'fwd'} ${name}: ${spanDiff(img, runs, spanBp, reversed)}`,
      )
    }
  }
  rows.push(`SPAN ${label} (${runs.count} runs)\n  ${out.join('\n  ')}`)
})

function barChannels(r: Runs): BarChannels {
  return {
    x: Uint32Array.from(r.x),
    x2: Uint32Array.from(r.x2),
    y: Float32Array.from(r.y),
    color: Uint32Array.from(r.color),
    count: r.count,
  }
}

const barParams = (seamPx: number) => ({
  domain: [0, 1] as [number, number],
  origin: 0,
  minWidthPx: 0,
  seamPx,
  rowHeight: H,
})

function barDiff(
  img: Uint8ClampedArray,
  runs: Runs,
  spanBp: number,
  reversed: boolean,
) {
  let bad = 0
  let outside = 0
  let holes = 0
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const i = truthAt(runs, spanBp, reversed, px)
      const inBar = i >= 0 && py + 0.5 >= H - runs.y[i]! * H
      const want = inBar ? [...rgbOf(runs.color[i]!), 255] : [0, 0, 0, 0]
      const o = (py * W + px) * 4
      if (pxDiff(img, o, want) > 24) {
        bad++
        if (!inBar) {
          outside++
        }
        if (inBar && img[o + 3]! < 230) {
          holes++
        }
      }
    }
  }
  const n = W * H
  return `${((100 * bad) / n).toFixed(2)}% off (stub ${((100 * outside) / n).toFixed(2)}%, hairline ${((100 * holes) / n).toFixed(2)}%)`
}

function paintBarsClampedSeam(
  ctx: Ctx,
  r: Runs,
  spanBp: number,
  reversed: boolean,
  seam: number,
) {
  const toX = (bp: number) =>
    reversed ? W - (bp / spanBp) * W : (bp / spanBp) * W
  for (let i = 0; i < r.count; i++) {
    const a = toX(r.x[i]!)
    const b = toX(r.x2[i]!)
    const left = Math.min(a, b)
    const width = Math.abs(b - a)
    const h = r.y[i]! * H
    const [cr, cg, cb] = rgbOf(r.color[i]!)
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`
    ctx.fillRect(left, H - h, width, h)
    if (i + 1 < r.count && r.x[i + 1] === r.x2[i]) {
      const hs = Math.min(h, r.y[i + 1]! * H)
      ctx.fillRect(reversed ? left - seam : left + width, H - hs, seam, hs)
    }
  }
}

test.each(ZOOMS)('bar seam, %s', (label, spanBp, maxRun) => {
  const out: string[] = []
  for (const mono of [false, true]) {
    const runs = tilingRuns(spanBp, maxRun, 11, mono)
    const ch = barChannels(runs)
    for (const reversed of [false, true]) {
      const b = block(spanBp, reversed)
      const variants: [string, Uint8ClampedArray][] = [
        [
          'core, seam 0.8 right',
          paint(ctx => {
            barMark.paintBlock(ctx, ch, b, frame, barParams(0.8))
          }),
        ],
        [
          'seam toward next painted',
          paint(ctx => {
            barMark.paintBlock(
              reversed ? leftSeamCtx(ctx, 0.8) : ctx,
              ch,
              b,
              frame,
              barParams(0.8),
            )
          }),
        ],
        [
          'toward next, clamped to overlap',
          paint(ctx => {
            paintBarsClampedSeam(ctx, runs, spanBp, reversed, 0.8)
          }),
        ],
        [
          'no seam',
          paint(ctx => {
            barMark.paintBlock(ctx, ch, b, frame, barParams(0))
          }),
        ],
      ]
      for (const [name, img] of variants) {
        out.push(
          `${mono ? 'mono ' : 'multi'} ${reversed ? 'rev' : 'fwd'} ${name}: ${barDiff(img, runs, spanBp, reversed)}`,
        )
      }
    }
  }
  rows.push(`BAR ${label}\n  ${out.join('\n  ')}`)
})
