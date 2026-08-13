// Does the generated `InstanceWriter` cost anything against a raw indexed loop?
//
//   node plugins/linear-comparative-view/benches/instanceWriter.bench.ts
//   node plugins/linear-comparative-view/benches/instanceWriter.bench.ts --rounds=9
//
// The question is live because the writer's signature fits more call sites than
// it should be used at. `packInstances` wants one flat array per field and a
// known count; an encoder with neither reaches for the writer, and the writer
// then looks like it also fits an encoder that merely computes one field —
// which is what synteny's `interleaveInstances` does. It does not fit that one,
// and this is the measurement that says so.
//
// Read `agent-docs/reference/BENCHMARKING.md` first. Three of its four rules are
// what this file is mostly made of, and the first version of this measurement
// broke two of them and reported numbers that were wrong in an interesting way
// (1.15x / 1.92x / 1.50x across three sizes — non-monotonic, which is the shape
// of noise rather than of a structural cost).
//
// SEPARATE DRIVERS, WRITTEN OUT LONGHAND. The duplication below is deliberate.
// The first version passed the implementation into one shared `time(fn, ...)`
// helper, which is the catalogue's first trap verbatim: one call site calling
// two implementations goes polymorphic and both arms pay for it.
//
// A CONTROL ARM. `interleaveRawB` is a second, separately-written copy of
// `interleaveRawA` — separate function literals, not a shared source string, so
// they get separate inline caches. Whatever it scores against A is this
// harness's floor at that moment, and the writer's ratio has to clear it.
//
// MIN ACROSS ROUNDS, interleaved round-robin. Interference only makes things
// slower, so the minimum is the closest thing to an uncontended sample.
//
// IDENTITY FIRST. All three arms must emit the same bytes before any timing is
// believed; a faster pack that writes different bytes is not a faster pack.
// Nothing to import, so `export {}` is what makes this a module rather than a
// global script — without it its top-level declarations collide with the
// sibling bench in plugins/canvas under one `tsc` run.
export {}

const STRIDE_WORDS = 8
const STRIDE_BYTES = 32
// syntenyFillStraight's Instance struct, spelled here rather than imported so
// the bench does not need the plugin's module graph. `syntenyPassGeometry.test.ts`
// is what pins the real layout; if these drift the identity check still holds,
// because all three arms read the same constants.
const F = {
  bp1: 0,
  bp2: 1,
  bp3: 2,
  bp4: 3,
  featureId: 5,
  alignmentLength: 6,
  kind: 7,
}
const U = { color: 4 }

interface Data {
  bp1: Float32Array
  bp2: Float32Array
  bp3: Float32Array
  bp4: Float32Array
  colors: Uint32Array
  kinds: Float32Array
  instanceFeatureIdx: Uint32Array
  alignmentLengths: Float32Array
  instanceCount: number
}

// ARM A: the raw loop, as `interleaveInstances` has it.
function interleaveRawA(data: Data) {
  const { bp1, bp2, bp3, bp4, colors, kinds } = data
  const { instanceFeatureIdx, alignmentLengths, instanceCount: n } = data
  const buf = new ArrayBuffer(n * STRIDE_BYTES)
  const f = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  for (let i = 0; i < n; i++) {
    const off = i * STRIDE_WORDS
    f[off + F.bp1] = bp1[i]!
    f[off + F.bp2] = bp2[i]!
    f[off + F.bp3] = bp3[i]!
    f[off + F.bp4] = bp4[i]!
    u32[off + U.color] = colors[i]!
    f[off + F.featureId] = instanceFeatureIdx[i]! + 1
    f[off + F.alignmentLength] = alignmentLengths[i]!
    f[off + F.kind] = kinds[i]!
  }
  return buf
}

// CONTROL ARM: byte-identical to A, written out a second time on purpose.
function interleaveRawB(data: Data) {
  const { bp1, bp2, bp3, bp4, colors, kinds } = data
  const { instanceFeatureIdx, alignmentLengths, instanceCount: n } = data
  const buf = new ArrayBuffer(n * STRIDE_BYTES)
  const f = new Float32Array(buf)
  const u32 = new Uint32Array(buf)
  for (let i = 0; i < n; i++) {
    const off = i * STRIDE_WORDS
    f[off + F.bp1] = bp1[i]!
    f[off + F.bp2] = bp2[i]!
    f[off + F.bp3] = bp3[i]!
    f[off + F.bp4] = bp4[i]!
    u32[off + U.color] = colors[i]!
    f[off + F.featureId] = instanceFeatureIdx[i]! + 1
    f[off + F.alignmentLength] = alignmentLengths[i]!
    f[off + F.kind] = kinds[i]!
  }
  return buf
}

// A transcription of what the codegen emits for this struct, so the bench does
// not need the generated module either.
class InstanceWriter {
  private buf: ArrayBuffer
  private f32: Float32Array
  private u32: Uint32Array
  private capacity: number
  count = 0

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity)
    this.buf = new ArrayBuffer(this.capacity * STRIDE_BYTES)
    this.f32 = new Float32Array(this.buf)
    this.u32 = new Uint32Array(this.buf)
  }

  push(
    bp1: number,
    bp2: number,
    bp3: number,
    bp4: number,
    color: number,
    featureId: number,
    alignmentLength: number,
    kind: number,
  ) {
    if (this.count === this.capacity) {
      this.capacity *= 2
      const grown = new ArrayBuffer(this.capacity * STRIDE_BYTES)
      new Uint8Array(grown).set(new Uint8Array(this.buf))
      this.buf = grown
      this.f32 = new Float32Array(grown)
      this.u32 = new Uint32Array(grown)
    }
    const o = this.count * STRIDE_WORDS
    this.f32[o] = bp1
    this.f32[o + 1] = bp2
    this.f32[o + 2] = bp3
    this.f32[o + 3] = bp4
    this.u32[o + 4] = color
    this.f32[o + 5] = featureId
    this.f32[o + 6] = alignmentLength
    this.f32[o + 7] = kind
    this.count++
  }

  finish() {
    const used = this.count * STRIDE_BYTES
    return used === this.buf.byteLength ? this.buf : this.buf.slice(0, used)
  }
}

// ARM W: the writer.
function interleaveWriter(data: Data) {
  const { bp1, bp2, bp3, bp4, colors, kinds } = data
  const { instanceFeatureIdx, alignmentLengths, instanceCount: n } = data
  const out = new InstanceWriter(n)
  for (let i = 0; i < n; i++) {
    out.push(
      bp1[i]!,
      bp2[i]!,
      bp3[i]!,
      bp4[i]!,
      colors[i]!,
      instanceFeatureIdx[i]! + 1,
      alignmentLengths[i]!,
      kinds[i]!,
    )
  }
  return out.finish()
}

// One driver per arm, each naming its implementation directly. Do not refactor
// these into one function taking the implementation as a parameter — see the
// header.
function timeRawA(data: Data, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    interleaveRawA(data)
  }
  return (performance.now() - t0) / reps
}
function timeRawB(data: Data, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    interleaveRawB(data)
  }
  return (performance.now() - t0) / reps
}
function timeWriter(data: Data, reps: number) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    interleaveWriter(data)
  }
  return (performance.now() - t0) / reps
}

function makeData(n: number): Data {
  const f = () => {
    const a = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      a[i] = i * 0.5
    }
    return a
  }
  const u = () => {
    const a = new Uint32Array(n)
    for (let i = 0; i < n; i++) {
      a[i] = i * 2654435761
    }
    return a
  }
  return {
    bp1: f(),
    bp2: f(),
    bp3: f(),
    bp4: f(),
    colors: u(),
    kinds: f(),
    instanceFeatureIdx: u(),
    alignmentLengths: f(),
    instanceCount: n,
  }
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

{
  const d = makeData(4096)
  for (const [label, fn] of [
    ['control', interleaveRawB],
    ['writer', interleaveWriter],
  ] as const) {
    const diff = sameBytes(interleaveRawA(d), fn(d))
    if (diff) {
      throw new Error(`${label} does not pack what the raw loop packs: ${diff}`)
    }
  }
  console.log('identity: all three arms pack the same bytes')
}

console.log(
  `\n${'instances'.padStart(10)}  ${'raw'.padStart(8)}  ${'writer'.padStart(8)}  ` +
    `${'ratio'.padStart(6)}  ${'control'.padStart(7)}`,
)
for (const n of [100_000, 500_000, 2_000_000]) {
  const data = makeData(n)
  const reps = n > 1_000_000 ? 15 : 50
  // Warm each arm through its own driver before timing, so all three are
  // measured against optimized code — an unoptimized method call is obviously
  // slower and is not the question.
  for (let r = 0; r < 15; r++) {
    timeRawA(data, 1)
    timeWriter(data, 1)
    timeRawB(data, 1)
  }
  let a = Infinity
  let w = Infinity
  let b = Infinity
  for (let round = 0; round < rounds; round++) {
    a = Math.min(a, timeRawA(data, reps))
    w = Math.min(w, timeWriter(data, reps))
    b = Math.min(b, timeRawB(data, reps))
  }
  console.log(
    `${n.toLocaleString().padStart(10)}  ${a.toFixed(2).padStart(8)}  ` +
      `${w.toFixed(2).padStart(8)}  ${(w / a).toFixed(3).padStart(6)}  ${(b / a).toFixed(3).padStart(7)}`,
  )
}
console.log(
  '\nms per pack, min of interleaved rounds. A control far from 1.00 means the\n' +
    'row measured nothing — re-run on a quieter machine before believing it.',
)
