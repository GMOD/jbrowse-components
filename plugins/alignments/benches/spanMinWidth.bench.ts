// What does it cost to place a coverage mark's left edge with the shader's own
// rule instead of a hand-written copy of it?
//
//   node --expose-gc plugins/alignments/benches/spanMinWidth.bench.ts
//
// Flags: --rounds=<n> (default 60), --only=<fixture substring>
//
// The harness rules — interleave, min-of-rounds, run a control, one process per
// fixture — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. `fillSpanRect` widens a sub-pixel mark to 1 CSS px about its
// midpoint, and it used to spell that rule itself. It now calls
// `expandToMinWidthPx`, generated from `hpmath.slang` (adr-051), which returns a
// `float2` — and the emitter's tuple convention makes that a `[number, number]`.
// So the one helper every coverage painter runs per covered bp now allocates,
// against a bar that file's own comment used to state.
//
// ARMS, each its own function literal with its own driver written out longhand,
// because a shared driver goes polymorphic and prices every arm for it:
//   generated  `fillSpanRect` as it ships — the twin, destructured
//   inline     the retired spelling, `w < 1 ? (px + px2) / 2 - 0.5 : px`
//   control    a second, separately-declared copy of `inline`. A row whose
//              control is far from 1.00 measured nothing.
//
// THE CTX IS A COUNTER, NOT A CANVAS, and that biases the answer one way on
// purpose: a real `ctx.fillRect` rasterizes, so the allocation's share of a real
// frame is SMALLER than what this reports. Read the number as an upper bound on
// the cost, not an estimate of it.
//
// WHAT IT SAYS, so far. One process per fixture, --rounds=60, control in
// brackets — and only ONE row has a control near 1.00, so only one row says
// anything:
//
//   pileup-spans    generated 4.30x  [0.97]   5.5 -> 23.7 ns/mark
//   band-subpixel   generated 2.36x  [1.89]   unresolved
//   band-wide       generated 1.65x  [1.19]   unresolved
//
// Taken at load average 53 on 16 cores, which is where the two 3000-mark
// fixtures stop resolving; re-run them on a quiet box before quoting either.
//
// The row that does resolve is the one worth reading anyway, and it says the
// RATIO is large and the ABSOLUTE is not: +18 ns per mark is ~22 microseconds
// on a 1200-mark frame, about 0.13% of a 16 ms budget, with a counter standing
// in for a rasterizing fillRect. So the generated rule costs several times the
// ternary it replaced and still costs nothing that a frame can feel — which is
// the shape where quoting the ratio alone would mislead.
//
// FIXTURE SIZE IS THE TRAP HERE. This is an allocation-per-record shape, and
// BENCHMARKING.md §"A window LARGE enough that the arms' own garbage decides the
// result" measured such a shape ceasing to resolve at ~4,000 records per arm —
// byte-identical controls at 0.63x. So the fixtures are the per-FRAME call
// counts, which is what the question is about anyway: `drawCoverageBins` walks
// the whole packed buffer but only calls `fillSpanRect` for bins that survive
// the viewport cull.

import { fillSpanRect } from '@jbrowse/alignments-core'

const args = process.argv.slice(2)
const ROUNDS = Number(
  args.find(a => a.startsWith('--rounds='))?.slice('--rounds='.length) ?? '60',
)
const ONLY = args.find(a => a.startsWith('--only='))?.slice('--only='.length)

// A ctx whose fillRect does arithmetic and allocates nothing, so the arms
// differ only in the rule. Its fields are read back for the identity check.
class CountingCtx {
  acc = 0
  fillRect(x: number, y: number, w: number, h: number) {
    this.acc += x + y + w + h
  }
}

// The retired spelling, kept verbatim — the same fixture
// `spanMinWidthParity.test.ts` sweeps.
function fillSpanRectInline(
  ctx: CountingCtx,
  px: number,
  px2: number,
  top: number,
  height: number,
  widthCompensation: number,
) {
  const w = px2 - px
  ctx.fillRect(
    w < 1 ? (px + px2) / 2 - 0.5 : px,
    top,
    Math.max(w + widthCompensation, 1),
    height,
  )
}

// Declared a second time on purpose: separate function literals is what gives
// separate inline caches, and sharing the SOURCE is enough to defeat that.
function fillSpanRectControl(
  ctx: CountingCtx,
  px: number,
  px2: number,
  top: number,
  height: number,
  widthCompensation: number,
) {
  const w = px2 - px
  ctx.fillRect(
    w < 1 ? (px + px2) / 2 - 0.5 : px,
    top,
    Math.max(w + widthCompensation, 1),
    height,
  )
}

interface Marks {
  left: Float64Array
  right: Float64Array
  top: Float64Array
  height: Float64Array
}

const driveGenerated = (m: Marks, n: number, pad: number) => {
  const ctx = new CountingCtx()
  for (let i = 0; i < n; i++) {
    fillSpanRect(
      ctx as never,
      m.left[i]!,
      m.right[i]!,
      m.top[i]!,
      m.height[i]!,
      pad,
    )
  }
  return ctx.acc
}

const driveInline = (m: Marks, n: number, pad: number) => {
  const ctx = new CountingCtx()
  for (let i = 0; i < n; i++) {
    fillSpanRectInline(
      ctx,
      m.left[i]!,
      m.right[i]!,
      m.top[i]!,
      m.height[i]!,
      pad,
    )
  }
  return ctx.acc
}

const driveControl = (m: Marks, n: number, pad: number) => {
  const ctx = new CountingCtx()
  for (let i = 0; i < n; i++) {
    fillSpanRectControl(
      ctx,
      m.left[i]!,
      m.right[i]!,
      m.top[i]!,
      m.height[i]!,
      pad,
    )
  }
  return ctx.acc
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

declare const gc: (() => void) | undefined

const FIXTURES = [
  // A coverage band at sub-pixel pitch: every bin the cull keeps, on a 2000 px
  // canvas at ~1.5 bins per pixel. The widening rule fires on all of them, which
  // is the branch that allocates in every arm's shader twin.
  { name: 'band-subpixel', count: 3000, pitch: 0.66, pad: 0.8 },
  // The same band past 1 bp/px, where no mark is sub-pixel and the twin returns
  // its inputs. Same call count, other branch.
  { name: 'band-wide', count: 3000, pitch: 4.5, pad: 0.8 },
  // The pileup's span marks (gaps, overlaps) over a deep window: fewer marks, no
  // seam pad, mixed widths.
  { name: 'pileup-spans', count: 1200, pitch: 0, pad: 0 },
]

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const rand = rng(9271)
  const { count, pitch, pad } = fx
  const marks: Marks = {
    left: new Float64Array(count),
    right: new Float64Array(count),
    top: new Float64Array(count),
    height: new Float64Array(count),
  }
  for (let i = 0; i < count; i++) {
    const left = pitch > 0 ? i * pitch : rand() * 2000
    const span = pitch > 0 ? pitch : 0.2 + rand() * 6
    marks.left[i] = left
    marks.right[i] = left + span
    marks.top[i] = rand() * 90
    marks.height[i] = 1 + rand() * 40
  }

  // Warm every arm the same number of times — asymmetric warmup is its own trap.
  for (let w = 0; w < 20; w++) {
    driveGenerated(marks, count, pad)
    driveInline(marks, count, pad)
    driveControl(marks, count, pad)
  }

  const base = driveInline(marks, count, pad)
  for (const [name, v] of [
    ['generated', driveGenerated(marks, count, pad)],
    ['control', driveControl(marks, count, pad)],
  ] as const) {
    if (base !== v) {
      console.error(`  IDENTITY FAIL: ${fx.name} ${name}: ${base} vs ${v}`)
      process.exit(1)
    }
  }

  const LABELS = ['inline', 'generated', 'control']
  const best: Record<string, number> = {
    inline: Infinity,
    generated: Infinity,
    control: Infinity,
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < LABELS.length; k++) {
      const which = (r + k) % LABELS.length
      const t = performance.now()
      if (which === 0) {
        driveInline(marks, count, pad)
      } else if (which === 1) {
        driveGenerated(marks, count, pad)
      } else {
        driveControl(marks, count, pad)
      }
      const ms = performance.now() - t
      const label = LABELS[which]!
      if (ms < best[label]!) {
        best[label] = ms
      }
    }
  }

  const baseline = best.inline!
  const ns = (ms: number) => (ms / count) * 1e6
  console.log(`\n${fx.name} (${count} marks/frame)`)
  console.log(
    `  inline    ${baseline.toFixed(3)}ms  ${ns(baseline).toFixed(1)} ns/mark`,
  )
  for (const label of ['generated', 'control']) {
    const ms = best[label]!
    console.log(
      `  ${label.padEnd(9)} ${ms.toFixed(3)}ms  ${ns(ms).toFixed(1)} ns/mark  ` +
        `${(ms / baseline).toFixed(2)}x`,
    )
  }
}
