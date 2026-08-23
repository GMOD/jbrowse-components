// How should a call site touch a packed instance buffer, given that the layout
// is generated from the `.slang` and the loops run 10^4-10^5 times?
//
//   node --expose-gc plugins/alignments/benches/instanceAccessors.bench.ts
//
// Flags: --rounds=<n> (default 40), --only=<fixture substring>, --allow-diff
//
// The harness rules — interleave, min-of-rounds, run a control, check identity
// before believing timing — are in `agent-docs/reference/BENCHMARKING.md`.
//
// THE QUESTION. The coverage-band buffers are written once per fetch in the RPC
// worker and read once per frame by the Canvas2D backend. Spelling
// `f32[i * STRIDE + OFFSET.field]` at each call site is the hand-rolled
// interleave the codegen exists to delete — but every generated alternative puts
// a function call somewhere, and the obvious one puts four per instance.
//
// The answer is not "generate the loop" but the sharper version of it: a
// generated form is free only when it leaves NO call inside the loop. There are
// three candidates and they differ by calls per record, not by how much of the
// loop they generate.
//
// WRITE ARMS:
//   inline      hand-written offset arithmetic, `o` hoisted once per instance
//   accessors   generated `setInstance<Field>` — FOUR calls per record
//   packed      generated `packInstances` — the whole loop, struct-of-arrays in,
//               ZERO calls per record
//   writer      the codegen's `InstanceWriter.push` — ONE call per record, plus
//               a capacity branch and four `this.` loads. For an encoder that
//               cannot size the buffer up front.
//   control     a second, separately-declared copy of `inline`. A row whose
//               control is far from 1.00 measured nothing.
//
// READ ARMS:
//   inline      hand-written, as the Canvas2D draw loops spell it
//   accessors   generated `getInstance<Field>` — four calls per record
//   forEach     a generated `forEachInstance` — the read-side counterpart to
//               `packInstances`, ONE callback per record
//   control     as above
//
// Each arm is its own function literal with its own call site, the round order
// rotates, every arm gets the same warmup, and each write arm has its own
// destination buffer.
//
// FIXTURES are the real record counts: the GPU coverage bin cap, an interbase
// histogram over a deep long-read window, and a SNP layer at short-read density.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Three runs, --rounds=60, control in brackets. Read the 60k and
// 12k rows, not `coverage-bin-cap`: at 262k instances that fixture is
// memory-bound enough that its own control swings on a contended box, and a row
// whose control is far from 1.00 measured nothing.
//
//   interbase-longread  write  packed    1.12x, 1.05x, 1.05x  [1.03, 0.93, 1.01]
//                              accessors 0.53x, 0.48x, 0.48x
//                              writer    0.36x, 0.21x, 0.20x
//                       read   accessors 0.66x, 0.60x, 0.58x  [0.99, 1.02, 1.00]
//                              forEach   0.49x, 0.25x, 0.14x
//   snp-shortread       write  packed    1.04x, 1.09x, 0.99x  [1.04, 1.45, 0.99]
//                              accessors 0.49x, 0.43x, 0.46x
//                              writer    0.34x, 0.29x, 0.34x
//                       read   accessors 0.70x, 0.71x, 0.58x
//                              forEach   0.51x, 0.52x, 0.48x
//
// So `packInstances` — the only form with no per-record call — is FREE, and is
// what `packSnpSegmentsForGpu` and `packModCovSegmentsForGpu` now run.
// Everything with a call inside the loop costs, and NOT in proportion to the
// call count: one `InstanceWriter.push` per record (0.20-0.36x) is worse than
// four bare accessors (0.43-0.53x), because the method also reloads four
// `this.` fields and tests capacity. One callback per record is worse again,
// because the closure writes through a context slot.
//
// The corollary for a caller that CANNOT hand `packInstances` one array per
// field — it scales on the way in, computes a field, or emits a variable number
// of records — is to write the loop over the generated offset maps, not to
// reach for a generated per-record form. `packCoverageBinsForGpu` and
// `computeInterbaseCoverage` are both that case. Written up in
// `agent-docs/reference/REJECTED_IDEAS.md`.

import {
  INSTANCE_OFFSET_F32 as SEG_F32,
  INSTANCE_OFFSET_U32 as SEG_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
  getInstanceColorType,
  getInstancePosition,
  getInstanceSegHeight,
  getInstanceYOffset,
  packInstances,
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

interface Cols {
  position: Uint32Array
  yOffset: Float32Array
  segHeight: Float32Array
  colorType: Uint8Array
}

// ---------------------------------------------------------------- write side

// BASELINE. Inline offset arithmetic, as coverageGpuPacking.ts spells it.
const writeInline = (buf: ArrayBuffer, c: Cols, count: number) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + SEG_U32.position] = c.position[i]!
    f32[o + SEG_F32.yOffset] = c.yOffset[i]!
    f32[o + SEG_F32.segHeight] = c.segHeight[i]!
    f32[o + SEG_F32.colorType] = c.colorType[i]!
  }
}

// CONTROL. Byte-identical to writeInline, separate literal on purpose.
const writeControl = (buf: ArrayBuffer, c: Cols, count: number) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    u32[o + SEG_U32.position] = c.position[i]!
    f32[o + SEG_F32.yOffset] = c.yOffset[i]!
    f32[o + SEG_F32.segHeight] = c.segHeight[i]!
    f32[o + SEG_F32.colorType] = c.colorType[i]!
  }
}

// GENERATED FIELD ACCESS. One call per field per instance.
const writeAccessors = (buf: ArrayBuffer, c: Cols, count: number) => {
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  for (let i = 0; i < count; i++) {
    setInstancePosition(u32, i, c.position[i]!)
    setInstanceYOffset(f32, i, c.yOffset[i]!)
    setInstanceSegHeight(f32, i, c.segHeight[i]!)
    setInstanceColorType(f32, i, c.colorType[i]!)
  }
}

// GENERATED LOOP. One call per buffer; the body is the generated twin of
// `writeInline`.
const writePacked = (buf: ArrayBuffer, c: Cols, count: number) => {
  packInstances(c, count, buf)
}

// ONE CALL PER RECORD, all four fields written inline at a hoisted offset
// inside it — the codegen's `InstanceWriter`, for an encoder that cannot size
// the buffer up front. Transcribed here rather than imported: it is emitted
// only under `//! instance-writer`, which coverageInterbase.slang does not
// declare BECAUSE of this row, so an import would be circular reasoning.
class Writer {
  private buf: ArrayBuffer
  private f32: Float32Array
  private u32: Uint32Array
  private capacity: number
  count = 0

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity)
    this.buf = new ArrayBuffer(this.capacity * INSTANCE_STRIDE_BYTES)
    this.f32 = new Float32Array(this.buf)
    this.u32 = new Uint32Array(this.buf)
  }

  push(
    position: number,
    yOffset: number,
    segHeight: number,
    colorType: number,
  ) {
    if (this.count === this.capacity) {
      this.capacity *= 2
      const grown = new ArrayBuffer(this.capacity * INSTANCE_STRIDE_BYTES)
      new Uint8Array(grown).set(new Uint8Array(this.buf))
      this.buf = grown
      this.f32 = new Float32Array(grown)
      this.u32 = new Uint32Array(grown)
    }
    const o = this.count * INSTANCE_STRIDE_WORDS
    this.u32[o] = position
    this.f32[o + 1] = yOffset
    this.f32[o + 2] = segHeight
    this.f32[o + 3] = colorType
    this.count++
  }

  finish() {
    const used = this.count * INSTANCE_STRIDE_BYTES
    return used === this.buf.byteLength ? this.buf : this.buf.slice(0, used)
  }
}

const writeWriter = (_buf: ArrayBuffer, c: Cols, count: number) => {
  const w = new Writer(count)
  for (let i = 0; i < count; i++) {
    w.push(c.position[i]!, c.yOffset[i]!, c.segHeight[i]!, c.colorType[i]!)
  }
  return w.finish()
}

// ----------------------------------------------------------------- read side
//
// Each returns a checksum rather than drawing: the draw loops' real work is
// `ctx.fillRect`, which would swamp what is being measured. This is the field
// access alone, i.e. the worst case for anything that adds a call.

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

const readAccessors = (buf: ArrayBuffer, count: number) => {
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

// The read-side counterpart to `packInstances` that the codegen does NOT emit,
// for the reason this row gives. Written by hand here so the result stays
// reproducible: a generated loop whose only call is one per record, taking the
// fields as arguments.
const forEachInstance = (
  buf: ArrayBuffer,
  fn: (
    i: number,
    position: number,
    yOffset: number,
    segHeight: number,
    colorType: number,
  ) => void,
) => {
  const f32 = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  const numInstances = buf.byteLength / INSTANCE_STRIDE_BYTES
  for (let i = 0; i < numInstances; i++) {
    const o = i * INSTANCE_STRIDE_WORDS
    fn(i, u32[o]!, f32[o + 1]!, f32[o + 2]!, f32[o + 3]!)
  }
}

const readForEach = (buf: ArrayBuffer, _count: number) => {
  let acc = 0
  forEachInstance(buf, (_i, position, yOffset, segHeight, colorType) => {
    acc += position + yOffset + segHeight + colorType
  })
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

const WRITE = ['inline', 'accessors', 'packed', 'writer', 'control']
const READ = ['inline', 'accessors', 'forEach', 'control']

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const rand = rng(4242)
  const { count } = fx
  const cols: Cols = {
    position: new Uint32Array(count),
    yOffset: new Float32Array(count),
    segHeight: new Float32Array(count),
    colorType: new Uint8Array(count),
  }
  for (let i = 0; i < count; i++) {
    cols.position[i] = 1_000_000 + i
    cols.yOffset[i] = rand()
    cols.segHeight[i] = rand()
    cols.colorType[i] = 1 + Math.floor(rand() * 3)
  }

  // A destination buffer per write arm, so no arm inherits another's memory
  // state, and one shared source buffer for the read arms.
  const bInline = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const bAccessors = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const bPacked = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const bWriter = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)
  const bControl = new ArrayBuffer(count * INSTANCE_STRIDE_BYTES)

  // Warm every arm the same number of times, then check identity in both
  // directions. Asymmetric warmup is its own entry in the trap catalogue.
  let writerOut = new ArrayBuffer(0)
  for (let w = 0; w < 20; w++) {
    writeInline(bInline, cols, count)
    writeAccessors(bAccessors, cols, count)
    writePacked(bPacked, cols, count)
    writerOut = writeWriter(bWriter, cols, count)
    writeControl(bControl, cols, count)
    readInline(bInline, count)
    readAccessors(bInline, count)
    readForEach(bInline, count)
    readControl(bInline, count)
  }
  sameBytes(`${fx.name} accessors`, bInline, bAccessors)
  sameBytes(`${fx.name} packed`, bInline, bPacked)
  sameBytes(`${fx.name} writer`, bInline, writerOut)
  sameBytes(`${fx.name} control`, bInline, bControl)
  const rBase = readInline(bInline, count)
  for (const [name, v] of [
    ['accessors', readAccessors(bInline, count)],
    ['forEach', readForEach(bInline, count)],
    ['control', readControl(bInline, count)],
  ] as const) {
    if (rBase !== v) {
      fail(`${fx.name} read ${name}: ${rBase} vs ${v}`)
    }
  }

  const LABELS = [
    ...WRITE.map(a => `write ${a}`),
    ...READ.map(a => `read ${a}`),
  ]
  const best: Record<string, number> = {}
  for (const l of LABELS) {
    best[l] = Infinity
  }
  const N = LABELS.length
  for (let r = 0; r < ROUNDS; r++) {
    gc?.()
    for (let k = 0; k < N; k++) {
      const which = (r + k) % N
      const t = performance.now()
      if (which === 0) {
        writeInline(bInline, cols, count)
      } else if (which === 1) {
        writeAccessors(bAccessors, cols, count)
      } else if (which === 2) {
        writePacked(bPacked, cols, count)
      } else if (which === 3) {
        writeWriter(bWriter, cols, count)
      } else if (which === 4) {
        writeControl(bControl, cols, count)
      } else if (which === 5) {
        readInline(bInline, count)
      } else if (which === 6) {
        readAccessors(bInline, count)
      } else if (which === 7) {
        readForEach(bInline, count)
      } else {
        readControl(bInline, count)
      }
      best[LABELS[which]!] = Math.min(
        best[LABELS[which]!]!,
        performance.now() - t,
      )
    }
  }

  const fmt = (n: number) => n.toFixed(3)
  console.log(`\n${fx.name}  (${count.toLocaleString()} instances)`)
  for (const [dir, arms] of [
    ['write', WRITE],
    ['read', READ],
  ] as const) {
    const base = best[`${dir} inline`]!
    const rest = arms
      .filter(a => a !== 'inline')
      .map(
        a =>
          `${a} ${fmt(best[`${dir} ${a}`]!)} ms (${(base / best[`${dir} ${a}`]!).toFixed(3)}x)`,
      )
      .join('   ')
    console.log(`  ${dir.padEnd(5)} inline ${fmt(base)} ms   ${rest}`)
  }
}
