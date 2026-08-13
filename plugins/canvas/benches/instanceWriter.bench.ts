// The other half of the `InstanceWriter` question, and it comes out the other
// way.
//
//   node plugins/canvas/benches/instanceWriter.bench.ts
//
// `plugins/linear-comparative-view/benches/instanceWriter.bench.ts` measures the
// writer against a raw indexed loop and finds it ~2x slower, which is why
// synteny keeps its loop. This one measures it against the shape multi-row
// features actually had — an append from inside a callback, bumping a `count`
// captured in a closure — because that is a different comparison and the
// conclusion is opposite. Both numbers are cited in the emitter's doc comment;
// neither should be quoted without the other.
//
// Same four rules as the sibling bench, same reasons: separate drivers written
// out longhand, a control arm that is the baseline declared twice, min of
// interleaved rounds, identity before timing. See
// `agent-docs/reference/BENCHMARKING.md`.
// See the sibling bench: `export {}` is what makes this a module rather than a
// global script, so the two files' declarations don't collide under `tsc`.
export {}

const STRIDE_WORDS = 4
const STRIDE_BYTES = 16
// multiRow's Instance struct, all four fields u32.
const O = { startBp: 0, endBp: 1, rowIndex: 2, color: 3 }

// Stand-in for `forEachDrawnFeature`: a callback per feature, skipping the ones
// a hidden legend category filters out. The skip is what makes the final count
// unknown up front, which is the property the writer exists for.
function forEachDrawn(
  n: number,
  cb: (i: number, rowIndex: number, color: number) => void,
) {
  for (let i = 0; i < n; i++) {
    if ((i & 15) === 0) {
      continue
    }
    cb(i, i % 40, 0xff00ff00)
  }
}

// ARM A: the previous form — stores inline in the callback, `count` closed over.
function buildInlineA(starts: Uint32Array, ends: Uint32Array, n: number) {
  const capacity = new ArrayBuffer(n * STRIDE_BYTES)
  const u32 = new Uint32Array(capacity)
  let count = 0
  forEachDrawn(n, (i, rowIndex, color) => {
    const base = count * STRIDE_WORDS
    u32[base + O.startBp] = starts[i]!
    u32[base + O.endBp] = ends[i]!
    u32[base + O.rowIndex] = rowIndex
    u32[base + O.color] = color
    count++
  })
  const used = count * STRIDE_BYTES
  return used === capacity.byteLength ? capacity : capacity.slice(0, used)
}

// CONTROL ARM: byte-identical to A, written out a second time on purpose.
function buildInlineB(starts: Uint32Array, ends: Uint32Array, n: number) {
  const capacity = new ArrayBuffer(n * STRIDE_BYTES)
  const u32 = new Uint32Array(capacity)
  let count = 0
  forEachDrawn(n, (i, rowIndex, color) => {
    const base = count * STRIDE_WORDS
    u32[base + O.startBp] = starts[i]!
    u32[base + O.endBp] = ends[i]!
    u32[base + O.rowIndex] = rowIndex
    u32[base + O.color] = color
    count++
  })
  const used = count * STRIDE_BYTES
  return used === capacity.byteLength ? capacity : capacity.slice(0, used)
}

// A transcription of what the codegen emits for this struct.
class InstanceWriter {
  private buf: ArrayBuffer
  private u32: Uint32Array
  private capacity: number
  count = 0

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity)
    this.buf = new ArrayBuffer(this.capacity * STRIDE_BYTES)
    this.u32 = new Uint32Array(this.buf)
  }

  push(startBp: number, endBp: number, rowIndex: number, color: number) {
    if (this.count === this.capacity) {
      this.capacity *= 2
      const grown = new ArrayBuffer(this.capacity * STRIDE_BYTES)
      new Uint8Array(grown).set(new Uint8Array(this.buf))
      this.buf = grown
      this.u32 = new Uint32Array(grown)
    }
    const o = this.count * STRIDE_WORDS
    this.u32[o] = startBp
    this.u32[o + 1] = endBp
    this.u32[o + 2] = rowIndex
    this.u32[o + 3] = color
    this.count++
  }

  finish() {
    const used = this.count * STRIDE_BYTES
    return used === this.buf.byteLength ? this.buf : this.buf.slice(0, used)
  }
}

// ARM W: the writer.
function buildWriter(starts: Uint32Array, ends: Uint32Array, n: number) {
  const out = new InstanceWriter(n)
  forEachDrawn(n, (i, rowIndex, color) => {
    out.push(starts[i]!, ends[i]!, rowIndex, color)
  })
  return out.finish()
}

// One driver per arm. Do not refactor into a shared helper — see the header.
function timeInlineA(s: Uint32Array, e: Uint32Array, n: number, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildInlineA(s, e, n)
  }
  return (performance.now() - t0) / reps
}
function timeInlineB(s: Uint32Array, e: Uint32Array, n: number, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildInlineB(s, e, n)
  }
  return (performance.now() - t0) / reps
}
function timeWriter(s: Uint32Array, e: Uint32Array, n: number, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    buildWriter(s, e, n)
  }
  return (performance.now() - t0) / reps
}

function sameBytes(a: ArrayBuffer, b: ArrayBuffer) {
  if (a.byteLength !== b.byteLength) {
    return `byteLength ${a.byteLength} vs ${b.byteLength}`
  }
  const x = new Uint8Array(a)
  const y = new Uint8Array(b)
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) {
      return `byte ${i}: ${x[i]} vs ${y[i]}`
    }
  }
  return undefined
}

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.slice(9) ?? 7,
)

function makeArrays(n: number) {
  const starts = new Uint32Array(n)
  const ends = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    starts[i] = i * 10
    ends[i] = i * 10 + 5
  }
  return { starts, ends }
}

{
  const { starts, ends } = makeArrays(4096)
  for (const [label, fn] of [
    ['control', buildInlineB],
    ['writer', buildWriter],
  ] as const) {
    const diff = sameBytes(
      buildInlineA(starts, ends, 4096),
      fn(starts, ends, 4096),
    )
    if (diff) {
      throw new Error(
        `${label} does not pack what the inline form packs: ${diff}`,
      )
    }
  }
  console.log('identity: all three arms pack the same bytes')
}

console.log(
  `\n${'features'.padStart(10)}  ${'inline'.padStart(8)}  ${'writer'.padStart(8)}  ` +
    `${'ratio'.padStart(6)}  ${'control'.padStart(7)}`,
)
for (const n of [100_000, 500_000, 2_000_000]) {
  const { starts, ends } = makeArrays(n)
  const reps = n > 1_000_000 ? 15 : 50
  for (let r = 0; r < 15; r++) {
    timeInlineA(starts, ends, n, 1)
    timeWriter(starts, ends, n, 1)
    timeInlineB(starts, ends, n, 1)
  }
  let a = Infinity
  let w = Infinity
  let b = Infinity
  for (let round = 0; round < rounds; round++) {
    a = Math.min(a, timeInlineA(starts, ends, n, reps))
    w = Math.min(w, timeWriter(starts, ends, n, reps))
    b = Math.min(b, timeInlineB(starts, ends, n, reps))
  }
  console.log(
    `${n.toLocaleString().padStart(10)}  ${a.toFixed(2).padStart(8)}  ` +
      `${w.toFixed(2).padStart(8)}  ${(w / a).toFixed(3).padStart(6)}  ${(b / a).toFixed(3).padStart(7)}`,
  )
}
console.log(
  '\nms per encode, min of interleaved rounds. A control far from 1.00 means the\n' +
    'row measured nothing — re-run on a quieter machine before believing it.',
)
