// Do the generated `getInstance*` accessors cost anything in the Canvas2D
// contact loop?
//
//   node plugins/hic/benches/instanceAccessors.bench.ts
//   node plugins/hic/benches/instanceAccessors.bench.ts --rounds=15
//
// `Canvas2DHicRenderer.drawContacts` reads three fields per contact through the
// generated accessors, under a comment asserting that "they are single
// typed-array indexes, so V8 inlines them, which is what lets this loop use them
// at all — it runs over 300k-4.5M contacts a frame". That was reasoning, not a
// measurement, and the same reasoning about `InstanceWriter.push` — also "just
// typed-array stores" — turned out to be wrong by 2.3x
// (`plugins/linear-comparative-view/benches/instanceWriter.bench.ts`). This loop
// is the largest per-contact budget in the tree AND it is the no-GPU path, so
// the assertion is worth converting into a number.
//
// The structural difference is not only the call. `getInstancePosition(f32, i, 0)`
// and `getInstancePosition(f32, i, 1)` and `getInstanceCount(f32, i)` each
// recompute `i * INSTANCE_STRIDE_WORDS`; a raw loop computes the offset once and
// adds a constant. So the accessor arm does three multiplies per contact where
// the raw arm does one.
//
// WHAT IS MODELLED. The reads, the diagonal-band cull that skips most contacts
// at a typical zoom, the count read, `mapHicCount`, and a palette lookup. What
// is NOT modelled is `ctx.fillRect`, which node has no canvas for and which is
// real work the accessor overhead would be diluted against. So a ratio here is
// an UPPER BOUND on the accessors' share of the real loop — if it is ~1.00 the
// question is closed, and if it is not, the absolute ms/frame column is the
// thing to weigh against a frame budget rather than the ratio.
//
// Same four rules as the sibling benches — separate drivers per arm, a control
// arm that is the baseline declared twice, min of interleaved rounds, identity
// before timing. See `agent-docs/reference/BENCHMARKING.md`.
export {}

const STRIDE_WORDS = 3

// The generated accessors, transcribed verbatim from
// `hic.iface.generated.ts` so the bench does not need the plugin's module graph.
function getInstancePosition(f32: Float32Array, i: number, c: number) {
  return f32[i * STRIDE_WORDS + c]!
}
function getInstanceCount(f32: Float32Array, i: number) {
  return f32[i * STRIDE_WORDS + 2]!
}

// A second, separately-written copy for the control arm — separate function
// literals so they get separate inline caches.
function getInstancePositionB(f32: Float32Array, i: number, c: number) {
  return f32[i * STRIDE_WORDS + c]!
}
function getInstanceCountB(f32: Float32Array, i: number) {
  return f32[i * STRIDE_WORDS + 2]!
}

// `mapHicCount`, from the generated JS twin. Declared once and called by all
// three arms deliberately: it is common to every arm, so whatever it costs
// cancels in the ratio, and duplicating it would be duplicating the thing under
// comparison rather than the thing being compared.
function mapHicCount(count: number, colorMaxScore: number, useLog: boolean) {
  const t = useLog
    ? Math.log2(Math.max(count, 1)) / Math.log2(Math.max(colorMaxScore, 2))
    : count / Math.max(colorMaxScore, 0.001)
  return Math.min(Math.max(t, 0), 1)
}

const LUT_SIZE = 128
const lut = new Float64Array(LUT_SIZE)
for (let i = 0; i < LUT_SIZE; i++) {
  lut[i] = i / LUT_SIZE
}

// ARM A: the loop as `drawContacts` has it.
function drawAccessors(
  instances: Float32Array,
  n: number,
  minSum: number,
  maxSum: number,
) {
  let sink = 0
  for (let i = 0; i < n; i++) {
    const px = getInstancePosition(instances, i, 0)
    const py = getInstancePosition(instances, i, 1)
    const sum = px + py
    if (sum < minSum || sum > maxSum) {
      continue
    }
    const count = getInstanceCount(instances, i)
    const t = mapHicCount(count, 100, true)
    const fill = lut[(t * (LUT_SIZE - 1)) | 0]!
    sink += fill + px + py
  }
  return sink
}

// CONTROL ARM: byte-identical to A, through the second copy of the accessors.
function drawAccessorsControl(
  instances: Float32Array,
  n: number,
  minSum: number,
  maxSum: number,
) {
  let sink = 0
  for (let i = 0; i < n; i++) {
    const px = getInstancePositionB(instances, i, 0)
    const py = getInstancePositionB(instances, i, 1)
    const sum = px + py
    if (sum < minSum || sum > maxSum) {
      continue
    }
    const count = getInstanceCountB(instances, i)
    const t = mapHicCount(count, 100, true)
    const fill = lut[(t * (LUT_SIZE - 1)) | 0]!
    sink += fill + px + py
  }
  return sink
}

// ARM R: the same loop indexing the buffer directly, offset computed once.
function drawRaw(
  instances: Float32Array,
  n: number,
  minSum: number,
  maxSum: number,
) {
  let sink = 0
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE_WORDS
    const px = instances[o]!
    const py = instances[o + 1]!
    const sum = px + py
    if (sum < minSum || sum > maxSum) {
      continue
    }
    const count = instances[o + 2]!
    const t = mapHicCount(count, 100, true)
    const fill = lut[(t * (LUT_SIZE - 1)) | 0]!
    sink += fill + px + py
  }
  return sink
}

// One driver per arm. Do not refactor into a shared helper taking the
// implementation as a parameter — that call site goes polymorphic and every arm
// pays for it, which is the first trap in the catalogue.
function timeAccessors(
  f: Float32Array,
  n: number,
  a: number,
  b: number,
  reps: number,
) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawAccessors(f, n, a, b)
  }
  return (performance.now() - t0) / reps
}
function timeControl(
  f: Float32Array,
  n: number,
  a: number,
  b: number,
  reps: number,
) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawAccessorsControl(f, n, a, b)
  }
  return (performance.now() - t0) / reps
}
function timeRaw(
  f: Float32Array,
  n: number,
  a: number,
  b: number,
  reps: number,
) {
  const t0 = performance.now()
  for (let r = 0; r < reps; r++) {
    drawRaw(f, n, a, b)
  }
  return (performance.now() - t0) / reps
}

// Positions on a diagonal band, counts log-distributed, so the cull rejects a
// realistic share rather than none or all.
function makeInstances(n: number) {
  const f32 = new Float32Array(n * STRIDE_WORDS)
  for (let i = 0; i < n; i++) {
    const o = i * STRIDE_WORDS
    f32[o] = (i * 37) % 4096
    f32[o + 1] = (i * 91) % 4096
    f32[o + 2] = 1 + ((i * 7) % 400)
  }
  return f32
}

const rounds = Number(
  process.argv.find(a => a.startsWith('--rounds='))?.slice(9) ?? 7,
)

{
  const f = makeInstances(4096)
  const [a, b, c] = [
    drawAccessors(f, 4096, 1000, 6000),
    drawAccessorsControl(f, 4096, 1000, 6000),
    drawRaw(f, 4096, 1000, 6000),
  ]
  if (a !== b || a !== c) {
    throw new Error(`arms disagree: accessors ${a}, control ${b}, raw ${c}`)
  }
  console.log('identity: all three arms compute the same sum')
}

console.log(
  `\n${'contacts'.padStart(10)}  ${'accessors'.padStart(9)}  ${'raw'.padStart(8)}  ` +
    `${'ratio'.padStart(6)}  ${'control'.padStart(7)}  ${'delta ms'.padStart(8)}`,
)
for (const n of [300_000, 1_000_000, 4_500_000]) {
  const f = makeInstances(n)
  // ~60% of contacts survive the band cull at these bounds.
  const [lo, hi] = [1000, 6000]
  const reps = n > 2_000_000 ? 10 : 30
  for (let r = 0; r < 12; r++) {
    timeAccessors(f, n, lo, hi, 1)
    timeRaw(f, n, lo, hi, 1)
    timeControl(f, n, lo, hi, 1)
  }
  let acc = Infinity
  let raw = Infinity
  let ctl = Infinity
  for (let round = 0; round < rounds; round++) {
    acc = Math.min(acc, timeAccessors(f, n, lo, hi, reps))
    raw = Math.min(raw, timeRaw(f, n, lo, hi, reps))
    ctl = Math.min(ctl, timeControl(f, n, lo, hi, reps))
  }
  console.log(
    `${n.toLocaleString().padStart(10)}  ${acc.toFixed(2).padStart(9)}  ` +
      `${raw.toFixed(2).padStart(8)}  ${(raw / acc).toFixed(3).padStart(6)}  ` +
      `${(ctl / acc).toFixed(3).padStart(7)}  ${(acc - raw).toFixed(2).padStart(8)}`,
  )
}
console.log(
  '\nms per pass, min of interleaved rounds. `ratio` is raw/accessors, so below\n' +
    '1.00 means the accessors cost. `delta ms` is what switching would save per\n' +
    'frame, and is the column to weigh — the real loop also calls ctx.fillRect,\n' +
    'which is not modelled here and which dilutes the ratio but not the delta.\n' +
    'A control far from 1.00 means the row measured nothing.',
)
