// Does `makeBpMapper` as one closure literal over `bpProjection` map at the
// speed of the two-literal form it replaced?
//
//   node --no-use-osr packages/render-core/benches/bpMapper.bench.ts --shape=span --blocks=forward
//
// Flags: --shape=span|cell and --blocks=forward|alternating, one of each per
// process (BENCHMARKING.md, "Looping several DATASETS"), --rounds=<n>
// (default 25), --allow-diff.
//
// A paint walks 8 blocks of 62,500 spans and makes 1M mapper calls. `span` is a
// span painter's loop over `makeBpMapper`: both edges, the 1px floor,
// `spanLeft`, a fillStyle per colour run and a fillRect on a counting context.
// `cell` fills both edges' base cells through `makeCellLeftMapper`.
// `alternating` reverses every other block, on every call warmup included.
//
// ARMS, each its own painter literal:
//
//   old       makeBpMapper's two-literal form and the makeCellLeftMapper over
//             it, copied verbatim into twoLiteralBpMapper.ts
//   control   a separately declared copy of old in the same module
//   new       the production functions
//
// Old and control are imported as new is (BENCHMARKING.md, "An arm declared in
// the bench").
//
// IDENTITY. After timing and before anything prints, every arm paints forward,
// reversed and alternating blocks on a recording context and must match old's
// every fillRect x and width by Object.is. Every timed paint is checked against
// old's counts and coordinate sum.
//
// WHAT IT SAYS. Nine processes per row, AC power, load 1.0-1.8, min of 30
// interleaved rounds, ratio to old. One span forward process read its control
// at 0.97x and is left out of its row:
//
//                         old ns      control     new
//   span   forward        6.4-7.2     0.98-1.01   0.98-1.01
//   span   alternating    13.7-15.5   0.98-1.00   0.43-0.44
//   cell   forward        6.9-7.6     1.00-1.01   1.00-1.01
//   cell   alternating    15.0-17.4   0.99-1.01   0.49-0.53
//
// Two closure literals make the mapper call megamorphic once a painter's blocks
// mix orientations, so TurboFan stops inlining it; one literal keeps it
// monomorphic. On forward blocks every arm's factory, `bpProjection` and
// closures inline into its painter (`--trace-turbo-inlining`), so the bytecode
// sizes decide nothing: makeBpMapper is 80 bytes old and 55 new plus
// `bpProjection`'s 84, each closure 32.
//
// In scratch copies, a wiggle bar loop, a point loop and a mapper passed to a
// non-inlined helper read 0.98-1.02x forward and 0.48-0.58x alternating, and a
// loop filling one cell per span instead of two read 1.00-1.04x forward. With
// every factory declared beside its painter instead of imported, span forward
// read 1.03-1.08x with `spanLeft` imported and 1.01-1.02x with it declared too.

import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'

import {
  makeBpMapper,
  makeCellLeftMapper,
  spanLeft,
} from '../src/canvas2dUtils.ts'
import {
  makeBpMapperControl,
  makeBpMapperOld,
  makeCellLeftMapperControl,
  makeCellLeftMapperOld,
} from './twoLiteralBpMapper.ts'

import type { RenderBlock } from '../src/renderBlock.ts'

const BLOCKS = 8
const SPANS_PER_BLOCK = 62_500
const BLOCK_BP = 400_000
const CANVAS_WIDTH_PX = 1600
const PAN_PX = 123.4567
const MIN_WIDTH_PX = 1
const CELL_WIDTH_PX = 0.5
const ROW_HEIGHT_PX = 10
const BAR_HEIGHT_PX = 8
const WARM_ROUNDS = 10
const PALETTE = [
  'rgba(51,85,204,1)',
  'rgba(34,170,68,1)',
  'rgba(204,136,17,1)',
  'rgba(136,68,153,1)',
  'rgba(17,119,238,1)',
  'rgba(153,153,153,1)',
  'rgba(0,68,170,1)',
  'rgba(238,34,102,1)',
]

interface SpanContext {
  fillStyle: string
  fillRect(x: number, y: number, w: number, h: number): void
}

class CountingContext implements SpanContext {
  fills = 0
  styles = 0
  sum = 0
  style = ''
  get fillStyle() {
    return this.style
  }
  set fillStyle(v: string) {
    this.style = v
    this.styles++
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.fills++
    this.sum += x + y + w + h
  }
}

class RecordingContext implements SpanContext {
  fillStyle = ''
  readonly xs: number[] = []
  readonly widths: number[] = []
  fillRect(x: number, _y: number, w: number) {
    this.xs.push(x)
    this.widths.push(w)
  }
}

interface Spans {
  blocks: RenderBlock[]
  start: Uint32Array
  end: Uint32Array
  row: Uint32Array
  color: Uint8Array
}

type Painter = (ctx: SpanContext, spans: Spans) => void

function paintSpansOld(ctx: SpanContext, spans: Spans) {
  const { blocks, start, end, row, color } = spans
  let last = -1
  for (let b = 0; b < blocks.length; b++) {
    const toX = makeBpMapperOld(blocks[b]!)
    const stop = (b + 1) * SPANS_PER_BLOCK
    for (let i = b * SPANS_PER_BLOCK; i < stop; i++) {
      const c = color[i]!
      if (c !== last) {
        ctx.fillStyle = PALETTE[c]!
        last = c
      }
      const x1 = toX(start[i]!)
      const x2 = toX(end[i]!)
      const width = Math.max(MIN_WIDTH_PX, Math.abs(x2 - x1))
      ctx.fillRect(
        spanLeft(x1, x2, width),
        row[i]! * ROW_HEIGHT_PX,
        width,
        BAR_HEIGHT_PX,
      )
    }
  }
}

function paintSpansControl(ctx: SpanContext, spans: Spans) {
  const { blocks, start, end, row, color } = spans
  let last = -1
  for (let b = 0; b < blocks.length; b++) {
    const toX = makeBpMapperControl(blocks[b]!)
    const stop = (b + 1) * SPANS_PER_BLOCK
    for (let i = b * SPANS_PER_BLOCK; i < stop; i++) {
      const c = color[i]!
      if (c !== last) {
        ctx.fillStyle = PALETTE[c]!
        last = c
      }
      const x1 = toX(start[i]!)
      const x2 = toX(end[i]!)
      const width = Math.max(MIN_WIDTH_PX, Math.abs(x2 - x1))
      ctx.fillRect(
        spanLeft(x1, x2, width),
        row[i]! * ROW_HEIGHT_PX,
        width,
        BAR_HEIGHT_PX,
      )
    }
  }
}

function paintSpansNew(ctx: SpanContext, spans: Spans) {
  const { blocks, start, end, row, color } = spans
  let last = -1
  for (let b = 0; b < blocks.length; b++) {
    const toX = makeBpMapper(blocks[b]!)
    const stop = (b + 1) * SPANS_PER_BLOCK
    for (let i = b * SPANS_PER_BLOCK; i < stop; i++) {
      const c = color[i]!
      if (c !== last) {
        ctx.fillStyle = PALETTE[c]!
        last = c
      }
      const x1 = toX(start[i]!)
      const x2 = toX(end[i]!)
      const width = Math.max(MIN_WIDTH_PX, Math.abs(x2 - x1))
      ctx.fillRect(
        spanLeft(x1, x2, width),
        row[i]! * ROW_HEIGHT_PX,
        width,
        BAR_HEIGHT_PX,
      )
    }
  }
}

function paintCellsOld(ctx: SpanContext, spans: Spans) {
  const { blocks, start, end, row, color } = spans
  let last = -1
  for (let b = 0; b < blocks.length; b++) {
    const cellLeft = makeCellLeftMapperOld(blocks[b]!)
    const stop = (b + 1) * SPANS_PER_BLOCK
    for (let i = b * SPANS_PER_BLOCK; i < stop; i++) {
      const c = color[i]!
      if (c !== last) {
        ctx.fillStyle = PALETTE[c]!
        last = c
      }
      const top = row[i]! * ROW_HEIGHT_PX
      ctx.fillRect(cellLeft(start[i]!), top, CELL_WIDTH_PX, BAR_HEIGHT_PX)
      ctx.fillRect(cellLeft(end[i]!), top, CELL_WIDTH_PX, BAR_HEIGHT_PX)
    }
  }
}

function paintCellsControl(ctx: SpanContext, spans: Spans) {
  const { blocks, start, end, row, color } = spans
  let last = -1
  for (let b = 0; b < blocks.length; b++) {
    const cellLeft = makeCellLeftMapperControl(blocks[b]!)
    const stop = (b + 1) * SPANS_PER_BLOCK
    for (let i = b * SPANS_PER_BLOCK; i < stop; i++) {
      const c = color[i]!
      if (c !== last) {
        ctx.fillStyle = PALETTE[c]!
        last = c
      }
      const top = row[i]! * ROW_HEIGHT_PX
      ctx.fillRect(cellLeft(start[i]!), top, CELL_WIDTH_PX, BAR_HEIGHT_PX)
      ctx.fillRect(cellLeft(end[i]!), top, CELL_WIDTH_PX, BAR_HEIGHT_PX)
    }
  }
}

function paintCellsNew(ctx: SpanContext, spans: Spans) {
  const { blocks, start, end, row, color } = spans
  let last = -1
  for (let b = 0; b < blocks.length; b++) {
    const cellLeft = makeCellLeftMapper(blocks[b]!)
    const stop = (b + 1) * SPANS_PER_BLOCK
    for (let i = b * SPANS_PER_BLOCK; i < stop; i++) {
      const c = color[i]!
      if (c !== last) {
        ctx.fillStyle = PALETTE[c]!
        last = c
      }
      const top = row[i]! * ROW_HEIGHT_PX
      ctx.fillRect(cellLeft(start[i]!), top, CELL_WIDTH_PX, BAR_HEIGHT_PX)
      ctx.fillRect(cellLeft(end[i]!), top, CELL_WIDTH_PX, BAR_HEIGHT_PX)
    }
  }
}

const ARM_NAMES = ['old', 'control', 'new'] as const

const SHAPES: Record<string, readonly [Painter, Painter, Painter]> = {
  span: [paintSpansOld, paintSpansControl, paintSpansNew],
  cell: [paintCellsOld, paintCellsControl, paintCellsNew],
}

const SCENARIOS: Record<string, (block: number) => boolean> = {
  forward: () => false,
  alternating: block => block % 2 === 1,
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function geometric(rand: () => number, mean: number) {
  return Math.floor(-Math.log(1 - rand()) * mean)
}

function spansOver(reversed: (block: number) => boolean): Spans {
  const rand = rng(31)
  const blockWidthPx = CANVAS_WIDTH_PX / BLOCKS
  const blocks = Array.from({ length: BLOCKS }, (_, b): RenderBlock => ({
    displayedRegionIndex: b,
    start: 20_000_000 + b * 3_000_000 + 0.3125,
    end: 20_000_000 + b * 3_000_000 + 0.3125 + BLOCK_BP,
    screenStartPx: b * blockWidthPx - PAN_PX,
    screenEndPx: (b + 1) * blockWidthPx - PAN_PX,
    reversed: reversed(b),
  }))
  const n = BLOCKS * SPANS_PER_BLOCK
  const start = new Uint32Array(n)
  const end = new Uint32Array(n)
  const row = new Uint32Array(n)
  const color = new Uint8Array(n)
  let pick = 0
  for (let i = 0; i < n; i++) {
    const block = blocks[Math.floor(i / SPANS_PER_BLOCK)]!
    const along = (i % SPANS_PER_BLOCK) / SPANS_PER_BLOCK
    start[i] = Math.floor(block.start + along * BLOCK_BP)
    end[i] = start[i]! + 1 + geometric(rand, 60)
    row[i] = Math.floor(rand() * 100)
    if (rand() < 1 / 12) {
      pick = Math.floor(rand() * PALETTE.length)
    }
    color[i] = pick
  }
  return { blocks, start, end, row, color }
}

function sameCounts(a: CountingContext, b: CountingContext) {
  return a.fills === b.fills && a.styles === b.styles && a.sum === b.sum
}

function recording(paint: Painter, spans: Spans) {
  const ctx = new RecordingContext()
  paint(ctx, spans)
  return ctx
}

function firstDifference(want: RecordingContext, got: RecordingContext) {
  if (want.xs.length !== got.xs.length) {
    return `${got.xs.length} rects against ${want.xs.length}`
  }
  for (let i = 0; i < want.xs.length; i++) {
    if (
      !Object.is(want.xs[i], got.xs[i]) ||
      !Object.is(want.widths[i], got.widths[i])
    ) {
      return `rect ${i}: x ${got.xs[i]} width ${got.widths[i]} against x ${want.xs[i]} width ${want.widths[i]}`
    }
  }
  return undefined
}

function identityFailures(arms: readonly Painter[]) {
  const failures: string[] = []
  const orientations = { ...SCENARIOS, reversed: () => true }
  for (const [orientation, reversed] of Object.entries(orientations)) {
    const spans = spansOver(reversed)
    const want = recording(arms[0]!, spans)
    for (let a = 1; a < arms.length; a++) {
      const diff = firstDifference(want, recording(arms[a]!, spans))
      if (diff) {
        failures.push(`${orientation}: ${ARM_NAMES[a]} against old: ${diff}`)
      }
    }
  }
  return failures
}

function main() {
  const arg = (name: string) =>
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
  const shape = arg('shape') ?? ''
  const scenario = arg('blocks') ?? ''
  const arms = SHAPES[shape]
  const reversed = SCENARIOS[scenario]
  if (!arms || !reversed) {
    console.error(
      `--shape=${Object.keys(SHAPES).join('|')} --blocks=${Object.keys(SCENARIOS).join('|')}`,
    )
    process.exit(1)
  }
  const rounds = Number(arg('rounds') ?? 25)
  const spans = spansOver(reversed)

  for (let w = 0; w < WARM_ROUNDS; w++) {
    for (const paint of arms) {
      paint(new CountingContext(), spans)
    }
  }

  const counted = arms.map(paint => {
    const ctx = new CountingContext()
    paint(ctx, spans)
    return ctx
  })
  const expected = counted[0]!
  if (!counted.every(ctx => sameCounts(ctx, expected))) {
    console.error(`COUNTS DIFFER ${shape} ${scenario}`)
    process.exit(1)
  }

  const best = arms.map(() => Infinity)
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < arms.length; k++) {
      const a = (r + k) % arms.length
      const ctx = new CountingContext()
      const t0 = performance.now()
      arms[a]!(ctx, spans)
      const ms = performance.now() - t0
      if (!sameCounts(ctx, expected)) {
        console.error(
          `TIMED RUN DIFFERS ${shape} ${scenario} ${ARM_NAMES[a]} round ${r}`,
        )
        process.exit(1)
      }
      best[a] = Math.min(best[a]!, ms)
    }
  }

  const failures = identityFailures(arms)
  for (const failure of failures) {
    console.error(`IDENTITY FAIL ${shape} ${failure}`)
  }
  if (failures.length > 0 && !process.argv.includes('--allow-diff')) {
    process.exit(1)
  }

  const power = execSync('cat /sys/class/power_supply/AC*/online')
    .toString()
    .trim()
  console.log(`AC online: ${power}`)
  console.log(execSync('uptime').toString().trim())
  console.log(
    `--shape=${shape} --blocks=${scenario}, ${rounds} interleaved rounds, min per arm, ${failures.length === 0 ? 'control and new match old by Object.is on forward, reversed and alternating blocks' : 'IDENTITY FAILED'}`,
  )
  const calls = 2 * spans.start.length
  const old = best[0]!
  console.log(
    `${'shape'.padEnd(7)}${'blocks'.padEnd(12)}${'calls'.padStart(8)}${'rects'.padStart(8)}${'styles'.padStart(7)}${'old'.padStart(17)}${'control'.padStart(9)}${'new'.padStart(7)}`,
  )
  console.log(
    `${shape.padEnd(7)}${scenario.padEnd(12)}${String(calls).padStart(8)}${String(expected.fills).padStart(8)}${String(expected.styles).padStart(7)}${`${old.toFixed(2)}ms ${((old / calls) * 1e6).toFixed(2)}ns`.padStart(17)}${`${(best[1]! / old).toFixed(2)}x`.padStart(9)}${`${(best[2]! / old).toFixed(2)}x`.padStart(7)}`,
  )
}

main()
