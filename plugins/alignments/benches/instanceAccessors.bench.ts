// Do the Slang-generated `getInstance<Field>` / `setInstance<Field>` accessors
// cost anything against the hand-written `f32[i * STRIDE + OFFSET.field]` they
// replaced?
//
//   node --expose-gc plugins/alignments/benches/instanceAccessors.bench.ts
//
// Flags: --rounds=<n> (default 40), --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. The coverage-band packed buffers are written once per fetch in
// the RPC worker and read once per frame by the Canvas2D backend, over 10^4-10^5
// records either way. Moving both sides onto the generated accessors buys the
// field/view pairing as a compile error instead of a convention — but it puts a
// function call where an inline index used to be, in the loops that do the most
// iterations in this pipeline. If that call does not inline, the trade is a real
// per-frame cost for a type check.
//
// So this is not a bench of a change that was made to be faster. It is the check
// that a change made for safety was free, and it is worth having as a standing
// answer: the same question comes up for every pass that moves onto the codegen.
//
// ARMS (per fixture, both directions timed):
//   inline      the hand-written offset arithmetic, offset hoisted once per
//               instance and reused by all four fields
//   generated   the `.slang`-generated accessors, which take an INSTANCE INDEX
//               and so recompute `i * STRIDE` once per field
//   offset      a hand-written stand-in for accessors that take a hoisted WORD
//               OFFSET instead — the codegen shape that would keep the
//               field/view pairing without the repeated multiply. This is the
//               arm that decides whether the pairing has to cost anything.
//   control     a second, separately-declared copy of `inline`. A row whose
//               control is far from 1.00 measured nothing.
//
// Each arm is its own function literal with its own call site, and the round
// order rotates, for the reasons the rule list gives.
//
// FIXTURES are the real record counts: the GPU coverage bin cap, an interbase
// histogram over a deep long-read window, and a SNP layer at short-read density.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Three runs, --rounds=60, control in brackets:
//
//   interbase-longread   write  0.46x [1.00], 0.49x [0.98], 0.46x [1.06]
//                               0.34 -> 0.74 ms
//                        read   0.62x [1.09], 0.62x [1.06], 0.58x [1.06]
//   snp-shortread        write  0.43x [1.04], 0.47x [1.02], 0.47x [1.03]
//                        read   0.63x [1.08], 0.58x [1.04], 0.58x [1.06]
//
// So the accessors cost roughly 2x on the write side and 1.7x on the read side,
// and THE COST IS THE CALL: the `offset` arm — which hoists `i * STRIDE` and so
// does exactly the arithmetic the inline arm does — comes in at 0.42-0.43x,
// no better than the index-taking one. There is no accessor shape that recovers
// it, which is why the packers and draw loops index inline and only cold
// readers use the generated functions. Written up in
// `agent-docs/reference/REJECTED_IDEAS.md`.
//
// Read the 60k and 12k rows, not `coverage-bin-cap`: at 262k instances the
// fixture is memory-bound enough that its own control swings 0.41-1.11 on a
// contended box, and a row whose control is far from 1.00 measured nothing.

import {
  INSTANCE_OFFSET_F32 as SEG_F32,
  INSTANCE_OFFSET_U32 as SEG_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
  getInstanceColorType,
  getInstancePosition,
  getInstanceSegHeight,
  getInstanceYOffset,
  setInstanceColorType,
  setInstancePosition,
  setInstanceSegHeight,
  setInstanceYOffset,
} from '../../../packages/alignments-core/src/interbaseHistogramLayout.generated.ts'

const arg = (name: string, dflt: string) =>
  process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ?? dflt

const ROUNDS = Number(arg('rounds', '40'))
const ONLY = arg('only', '')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ---------------------------------------------------------------- write side

// BASELINE. Inline offset arithmetic, as coverageGpuPacking.ts spelled it.
const writeInline = (
  buf: ArrayBuffer,
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + SEG_U32.position] = positions[i]!
    f32[o + SEG_F32.yOffset] = yOffsets[i]!
    f32[o + SEG_F32.segHeight] = heights[i]!
    f32[o + SEG_F32.colorType] = colorTypes[i]!
  }
}

// CONTROL. Byte-identical to writeInline, separate literal on purpose.
const writeControl = (
  buf: ArrayBuffer,
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + SEG_U32.position] = positions[i]!
    f32[o + SEG_F32.yOffset] = yOffsets[i]!
    f32[o + SEG_F32.segHeight] = heights[i]!
    f32[o + SEG_F32.colorType] = colorTypes[i]!
  }
}

// NEW. The generated per-field setters, as it ships.
const writeGenerated = (
  buf: ArrayBuffer,
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    setInstancePosition(u32, i, positions[i]!)
    setInstanceYOffset(f32, i, yOffsets[i]!)
    setInstanceSegHeight(f32, i, heights[i]!)
    setInstanceColorType(f32, i, colorTypes[i]!)
  }
}

// OFFSET-TAKING. What the codegen could emit instead: the caller hoists
// `i * STRIDE` and each field accessor takes it. Declared here by hand as a
// stand-in, so the codegen change can be decided on a number.
const setPositionAt = (u32: Uint32Array, o: number, v: number) => {
  u32[o + SEG_U32.position] = v
}
const setYOffsetAt = (f32: Float32Array, o: number, v: number) => {
  f32[o + SEG_F32.yOffset] = v
}
const setSegHeightAt = (f32: Float32Array, o: number, v: number) => {
  f32[o + SEG_F32.segHeight] = v
}
const setColorTypeAt = (f32: Float32Array, o: number, v: number) => {
  f32[o + SEG_F32.colorType] = v
}

const writeOffset = (
  buf: ArrayBuffer,
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    setPositionAt(u32, o, positions[i]!)
    setYOffsetAt(f32, o, yOffsets[i]!)
    setSegHeightAt(f32, o, heights[i]!)
    setColorTypeAt(f32, o, colorTypes[i]!)
  }
}

// ----------------------------------------------------------------- read side
//
// Each returns a checksum rather than drawing: the draw loops' real work is
// `ctx.fillRect`, which would swamp what is being measured. This is the field
// access alone, i.e. the worst case for the accessors.

const readInline = (buf: ArrayBuffer, count: number) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let acc = 0
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    acc +=
      u32[o + SEG_U32.position]! +
      f32[o + SEG_F32.yOffset]! +
      f32[o + SEG_F32.segHeight]! +
      f32[o + SEG_F32.colorType]!
  }
  return acc
}

const readControl = (buf: ArrayBuffer, count: number) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let acc = 0
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    acc +=
      u32[o + SEG_U32.position]! +
      f32[o + SEG_F32.yOffset]! +
      f32[o + SEG_F32.segHeight]! +
      f32[o + SEG_F32.colorType]!
  }
  return acc
}

const getPositionAt = (u32: Uint32Array, o: number) =>
  u32[o + SEG_U32.position]!
const getYOffsetAt = (f32: Float32Array, o: number) => f32[o + SEG_F32.yOffset]!
const getSegHeightAt = (f32: Float32Array, o: number) =>
  f32[o + SEG_F32.segHeight]!
const getColorTypeAt = (f32: Float32Array, o: number) =>
  f32[o + SEG_F32.colorType]!

const readOffset = (buf: ArrayBuffer, count: number) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let acc = 0
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    acc +=
      getPositionAt(u32, o) +
      getYOffsetAt(f32, o) +
      getSegHeightAt(f32, o) +
      getColorTypeAt(f32, o)
  }
  return acc
}

const readGenerated = (buf: ArrayBuffer, count: number) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let acc = 0
  for (let i = 0; i < count; i++) {
    acc +=
      getInstancePosition(u32, i) +
      getInstanceYOffset(f32, i) +
      getInstanceSegHeight(f32, i) +
      getInstanceColorType(f32, i)
  }
  return acc
}

function fail(msg: string) {
  console.error(`  IDENTITY FAIL: ${msg}`)
  if (!ALLOW_DIFF) {
    process.exit(1)
  }
}

function sameBytes(name: string, a: ArrayBuffer, b: ArrayBuffer) {
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  if (x.length !== y.length) {
    fail(`${name}: length ${x.length} vs ${y.length}`)
    return
  }
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) {
      fail(`${name}: byte ${i} is ${x[i]} vs ${y[i]}`)
      return
    }
  }
}

declare const gc: (() => void) | undefined

const FIXTURES = [
  // The GPU coverage-bin cap (packCoverageArea's MAX_GPU_COVERAGE_BINS), i.e.
  // the largest instance buffer this pipeline ever packs.
  { name: 'coverage-bin-cap', count: 262_144 },
  // An interbase histogram over a deep long-read window: up to three stacked
  // segments at each of ~20k event positions.
  { name: 'interbase-longread', count: 60_000 },
  // A SNP layer at short-read density over a 200 kb window.
  { name: 'snp-shortread', count: 12_000 },
]

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const rand = rng(4242)
  const { count } = fx
  const positions = new Uint32Array(count)
  const yOffsets = new Float32Array(count)
  const heights = new Float32Array(count)
  const colorTypes = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    positions[i] = 1_000_000 + i
    yOffsets[i] = rand()
    heights[i] = rand()
    colorTypes[i] = 1 + Math.floor(rand() * 3)
  }

  // A destination buffer per write arm, so no arm inherits another's memory
  // state, and one shared source buffer for the read arms.
  const bufA = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const bufB = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const bufC = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const bufD = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)

  // Warm every arm the same number of times, then check identity in both
  // directions. Asymmetric warmup is its own entry in the trap catalogue.
  for (let w = 0; w < 20; w++) {
    writeInline(bufA, positions, yOffsets, heights, colorTypes, count)
    writeGenerated(bufB, positions, yOffsets, heights, colorTypes, count)
    writeOffset(bufD, positions, yOffsets, heights, colorTypes, count)
    writeControl(bufC, positions, yOffsets, heights, colorTypes, count)
    readInline(bufA, count)
    readGenerated(bufA, count)
    readOffset(bufA, count)
    readControl(bufA, count)
  }
  sameBytes(`${fx.name} generated`, bufA, bufB)
  sameBytes(`${fx.name} offset`, bufA, bufD)
  sameBytes(`${fx.name} control`, bufA, bufC)
  const rA = readInline(bufA, count)
  for (const [name, v] of [
    ['generated', readGenerated(bufA, count)],
    ['offset', readOffset(bufA, count)],
    ['control', readControl(bufA, count)],
  ] as const) {
    if (rA !== v) {
      fail(`${fx.name} read ${name}: ${rA} vs ${v}`)
    }
  }

  const LABELS = [
    'write inline',
    'write generated',
    'write offset',
    'write control',
    'read inline',
    'read generated',
    'read offset',
    'read control',
  ]
  const best: Record<string, number> = {}
  for (const l of LABELS) {
    best[l] = Infinity
  }
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < 8; k++) {
      const which = (r + k) % 8
      const t = performance.now()
      if (which === 0) {
        writeInline(bufA, positions, yOffsets, heights, colorTypes, count)
      } else if (which === 1) {
        writeGenerated(bufB, positions, yOffsets, heights, colorTypes, count)
      } else if (which === 2) {
        writeOffset(bufD, positions, yOffsets, heights, colorTypes, count)
      } else if (which === 3) {
        writeControl(bufC, positions, yOffsets, heights, colorTypes, count)
      } else if (which === 4) {
        readInline(bufA, count)
      } else if (which === 5) {
        readGenerated(bufA, count)
      } else if (which === 6) {
        readOffset(bufA, count)
      } else {
        readControl(bufA, count)
      }
      best[LABELS[which]!] = Math.min(
        best[LABELS[which]!]!,
        performance.now() - t,
      )
    }
  }

  const fmt = (n: number) => n.toFixed(3)
  console.log(`\n${fx.name}  (${count.toLocaleString()} instances)`)
  for (const dir of ['write', 'read']) {
    const base = best[`${dir} inline`]!
    const r = (k: string) =>
      `${fmt(best[`${dir} ${k}`]!)} ms (${(base / best[`${dir} ${k}`]!).toFixed(3)}x)`
    console.log(
      `  ${dir.padEnd(5)} inline ${fmt(base)} ms   generated ${r('generated')}` +
        `   offset ${r('offset')}   control ${r('control')}`,
    )
  }
}
