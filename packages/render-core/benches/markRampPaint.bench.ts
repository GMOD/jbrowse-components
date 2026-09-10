// What does resolving a quantitative colour ramp on the main thread cost the
// Canvas2D fallback, per repaint?
//
//   node packages/render-core/benches/markRampPaint.bench.ts
//   node packages/render-core/benches/markRampPaint.bench.ts --rounds=20 --bars=200000
//
// The harness rules — interleave, min-of-rounds, a separately-declared
// control, an identity check before any timing is believed — are in
// agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. ADR-113 moved a `linear`/`log` colour scale out of the worker:
// the payload carries the raw values and the shape resolves them against a
// domain unioned over the loaded regions. On the GPU backends that is a
// uniform and a 1 KB LUT, so a repaint costs nothing. The Canvas2D fallback —
// which is also the SVG export — has no sampler, so something has to turn
// values into `fillStyle`s, and the question is whether a pan pays for it.
//
// FOUR ARMS, each one full `barMark.paintBlock` over one region's bars:
//
//   packed      the worker-resolved colour lane, what shipped before — one
//               `Uint32Array` read per instance
//   baked       the ramp with the domain unchanged since the last repaint,
//               which is every pan, every hover and every height drag: the
//               bake is memoized on the payload and the loop is `packed`'s
//   control     a second, separately-declared copy of `baked`
//   perPaint    the ramp with the domain moved every repaint, so the bake
//               runs inside the frame — the ceiling, and what resolving the
//               scale per paint would cost every frame
//
// `perPaint` is the ceiling and `baked` the steady state. A domain moves when
// a region finishes loading, not when the view moves, so the bake is paid
// once per fetch and `baked` is what a pan, a hover or a height drag pays.
import { performance } from 'node:perf_hooks'

import { barMark } from '../src/marks/barMark.ts'
import { normalizeScore } from '../src/shaders/scoreScale.js.generated.ts'

import type { BarChannels, BarParams } from '../src/marks/barMark.ts'
import type { MarkContext2D } from '../src/marks/types.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rounds = arg('rounds', 15)
const n = arg('bars', 200_000)

const block = {
  displayedRegionIndex: 0,
  start: 0,
  end: n * 4,
  screenStartPx: 0,
  screenEndPx: 1600,
  reversed: false,
}
const frame = { canvasWidth: 1600, canvasHeight: 200 }

const lut = new Uint8Array(256 * 4)
for (let i = 0; i < 256; i++) {
  lut[i * 4] = i
  lut[i * 4 + 1] = 255 - i
  lut[i * 4 + 2] = 128
  lut[i * 4 + 3] = 255
}

const values = Float32Array.from({ length: n }, (_, i) => (i * 7919) % 1000)
const xs = Uint32Array.from({ length: n }, (_, i) => i * 4)
const x2s = Uint32Array.from({ length: n }, (_, i) => i * 4 + 3)
const ys = Float32Array.from({ length: n }, (_, i) => ((i * 13) % 100) / 100)

function lutAbgr(t: number) {
  const o = Math.round(t * 255) * 4
  return (
    ((lut[o + 3]! << 24) |
      (lut[o + 2]! << 16) |
      (lut[o + 1]! << 8) |
      lut[o]!) >>>
    0
  )
}

const packedColors = Uint32Array.from(values, v =>
  lutAbgr(normalizeScore(v, 0, 1000, 0, 1)),
)

function channels(ramp: boolean): BarChannels {
  return {
    x: xs,
    x2: x2s,
    y: ys,
    ...(ramp ? { colorValue: values } : { color: packedColors }),
    count: n,
  }
}

const base: Omit<BarParams, 'ramp'> = {
  domain: [0, 1],
  origin: 0,
  minWidthPx: 0,
}
const ramp = {
  domain: [0, 1000] as [number, number],
  scale: 'linear' as const,
  lut,
}

// A context with the two members this painter touches and nothing more: the
// arms differ in how they REACH a fillStyle, so the sink has to be the same
// trivial cost in each.
let sunk = 0
const ctx = {
  set fillStyle(v: string) {
    sunk += v.length
  },
  fillRect(_x: number, _y: number, _w: number, _h: number) {},
} as unknown as MarkContext2D

const packedChannels = channels(false)
const bakedChannels = channels(true)
const controlChannels = channels(true)
const perPaintChannels = channels(true)

// One driver per arm, written out longhand: a shared driver makes the call
// site polymorphic and hands every arm one set of inline caches.
const packed = () => {
  barMark.paintBlock(ctx, packedChannels, block, frame, base)
}
const baked = () => {
  barMark.paintBlock(ctx, bakedChannels, block, frame, { ...base, ramp })
}
const control = () => {
  barMark.paintBlock(ctx, controlChannels, block, frame, { ...base, ramp })
}
let moved = 0
const perPaint = () => {
  moved += 1
  barMark.paintBlock(ctx, perPaintChannels, block, frame, {
    ...base,
    ramp: { ...ramp, domain: [0, 1000 + moved] },
  })
}

const ARMS = [
  { name: 'packed', run: packed },
  { name: 'baked', run: baked },
  { name: 'control', run: control },
  { name: 'perPaint', run: perPaint },
]

// identity: the bake and the worker's own resolution answer the same colours
const bakedOnce = channels(true)
barMark.paintBlock(ctx, bakedOnce, block, frame, { ...base, ramp })
const bakedColors = bakedOnce.rampBake!.colors
for (let i = 0; i < n; i++) {
  if (bakedColors[i] !== packedColors[i]) {
    throw new Error(`bake disagrees with the worker at instance ${i}`)
  }
}
console.log(`${n.toLocaleString()} bars, bake matches the packed lane`)

const best = ARMS.map(() => Infinity)
for (let r = 0; r < rounds; r++) {
  for (const [i, { run }] of ARMS.entries()) {
    const t0 = performance.now()
    run()
    best[i] = Math.min(best[i]!, performance.now() - t0)
  }
}

console.log(`\nrounds=${rounds}, ${n.toLocaleString()} bars, min per arm`)
for (const [i, { name }] of ARMS.entries()) {
  const ms = best[i]!
  console.log(
    `  ${name.padEnd(12)} ${ms.toFixed(2).padStart(8)}ms  ` +
      `${((ms / n) * 1e6).toFixed(0).padStart(5)}ns/bar  ` +
      `${(ms / best[0]!).toFixed(2)}x packed`,
  )
}
console.log(`(sink ${sunk})`)
