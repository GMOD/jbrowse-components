// What does the hover position index COST in memory, and what does keying it by
// stride add?
//
//   node --expose-gc packages/alignments-core/benches/hoverIndexMemory.bench.ts
//
// Flags: --arrays=<n> (default 40), --only=<fixture substring>
//
// THE QUESTION. `hoverIndex.bench.ts` measures the index's SPEED and concludes
// it pays for itself within two mousemoves. It says nothing about memory, and
// the index is retained for as long as the array it indexes — which on a
// long-read pileup is the whole fetched block, per region, per stacked track.
// `positionIndex.ts` claims "8 bytes per entry ... a fraction of what it makes
// usable". This checks that claim against the real allocator, and prices the
// per-stride keying separately, since that is a strictly ADDED allocation.
//
// WHY IT IS NOT A TIMING BENCH. Memory is not a ratio you can interleave — the
// numbers here are heap deltas across a gc barrier, so the harness rules that
// matter are different ones: allocate K independent arrays rather than one (a
// single sample is dominated by whatever else the process was doing), read
// `arrayBuffers` separately from `heapUsed` (a typed array's backing store is
// external to the JS heap, so heapUsed alone MISSES the index almost entirely),
// and gc on both sides of every measurement.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Array count scaled per fixture (see `arraysFor`), 2026-08-14, on
// AC — though unlike the timing bench beside it these numbers are allocation
// counts across a gc barrier and came back byte-identical on battery, so the power
// state is recorded rather than load-bearing:
//
//   longread-400k    42 arrays   index 3.05 MB/array  8.00 B/entry  2.00x src  0.57x parallel
//   shortread-40k   420 arrays   index 0.29 MB/array  7.71 B/entry  1.93x src  0.55x parallel
//   deep-1m          17 arrays   index 7.60 MB/array  7.97 B/entry  1.99x src  0.57x parallel
//
// Theory is 8 B/entry exactly — `order` and `sorted` are both `Uint32Array(n)` —
// and all three fixtures now land within 4% of it. They did not before: at a flat
// 40 arrays `shortread-40k` read **5.00 B/entry**, which is this method's floor
// rather than a result, and is what `arraysFor` exists to keep out of the table.
//
// So the index is 2x the positions array it indexes and 0.57x the whole parallel
// mismatch set it makes usable (14 B/entry — positions u32, Ys u16, bases u8,
// strands i8, readIndices u32, frequencies u8, quals u8). `positionIndex.ts`
// claims "a fraction of what it makes usable" and that is right, but only against
// the full set: against `mismatchPositions` alone it DOUBLES it.
//
// The number that matters for a decision is neither ratio, it is the absolute:
// 7.6 MB per 1M-entry array, retained per region, per stacked track, invisibly.
//
// **What this bench now measures is the interbase memo only.** The mismatch
// readers stopped using the index — their producers sort, so there is nothing to
// retain — and that is the answer this measurement argued for. It is kept pointed
// at `positionIndexFor` because one caller remains (`interbasePositions`, whose
// type-grouping contract blocks the same fix; TODO.md has it), and because the
// per-entry cost is the figure that decides whether shipping an order array for it
// is worth 4 bytes an entry.
//
// The `index JS heap (objects)` line is what a per-stride COLLECTION beside the
// index would cost, and is why the stride is carried on the index instead: ~24
// bytes/array either way, i.e. under the noise, so the version that allocates
// nothing extra wins by default rather than by measurement. Negative values on
// that line are gc artifacts, not savings.

import { positionIndexFor } from '../src/positionIndex.ts'

const ARRAYS_OVERRIDE = process.argv.find(a => a.startsWith('--arrays='))
  ? Number(process.argv.find(a => a.startsWith('--arrays='))!.slice(9))
  : undefined
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7)

// Array count is SCALED PER FIXTURE, to a fixed total index budget, because a
// fixed count puts small fixtures under the measurement floor. `shortread-40k`
// at 40 arrays is only 12 MB of index and read **5.00 B/entry**; at 400 arrays
// the same fixture reads 8.00, which is theory. The deltas here are page-granular
// and compete with whatever the previous fixture left collectable, so the fix is
// to make every fixture allocate a comparable total rather than to quote a low
// row. `--arrays=<n>` overrides for a one-off.
const TARGET_INDEX_BYTES = 128 * 1024 * 1024
const arraysFor = (entries: number) =>
  ARRAYS_OVERRIDE ?? Math.max(8, Math.ceil(TARGET_INDEX_BYTES / (entries * 8)))

// Same fixtures as hoverIndex.bench.ts, so the memory numbers can be read
// against that file's timing numbers for the same shapes.
const FIXTURES = [
  { name: 'longread-400k', width: 200_000, mismatches: 400_000 },
  { name: 'shortread-40k', width: 200_000, mismatches: 40_000 },
  { name: 'deep-1m', width: 150_000, mismatches: 1_000_000 },
]

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function settle() {
  globalThis.gc?.()
  globalThis.gc?.()
}

function sample() {
  settle()
  const m = process.memoryUsage()
  return { heap: m.heapUsed, buffers: m.arrayBuffers }
}

const MB = (b: number) => b / 1024 / 1024

for (const fx of FIXTURES) {
  if (ONLY && !fx.name.includes(ONLY)) {
    continue
  }
  const ARRAYS = arraysFor(fx.mismatches)
  const coverageStartPos = 1_000_000
  // Positions in READ order (shuffled), over a window the width of a block —
  // the shape the worker actually ships.
  const makePositions = (seed: number) => {
    const rand = rng(seed)
    const out = new Uint32Array(fx.mismatches)
    for (let i = 0; i < fx.mismatches; i++) {
      out[i] = coverageStartPos + Math.floor(rand() * fx.width)
    }
    return out
  }

  // Hold the arrays alive for the whole measurement — the WeakMap drops its
  // entry the moment the key is collectable, so a bench that lets them go
  // measures nothing.
  const arrays: Uint32Array[] = []
  for (let k = 0; k < ARRAYS; k++) {
    arrays.push(makePositions(9001 + k))
  }

  const before = sample()
  for (const a of arrays) {
    positionIndexFor(a)
  }
  const after = sample()

  const perArrayBuffers = (after.buffers - before.buffers) / ARRAYS
  const perArrayHeap = (after.heap - before.heap) / ARRAYS
  const sourceBytes = fx.mismatches * 4
  // What the index makes usable: the whole parallel mismatch set the worker
  // ships, enumerated rather than guessed (RenderAlignmentDataRPC/types.ts) —
  // positions u32(4) + Ys u16(2) + bases u8(1) + strands i8(1) +
  // readIndices u32(4) + frequencies u8(1) + quals u8(1) = 14 B/entry.
  // Counting only the three in `MismatchArrays` gives 6 and overstates the
  // index's share more than twofold, which is the mistake to not repeat here.
  const parallelBytes = fx.mismatches * 14

  console.log(`\n${fx.name}  ${fx.mismatches} entries, ${ARRAYS} arrays`)
  console.log(
    `  source positions array      ${MB(sourceBytes).toFixed(2)} MB  (${(sourceBytes / fx.mismatches).toFixed(1)} B/entry)`,
  )
  console.log(
    `  index backing stores        ${MB(perArrayBuffers).toFixed(2)} MB  (${(perArrayBuffers / fx.mismatches).toFixed(2)} B/entry)`,
  )
  console.log(
    `  index JS heap (objects)     ${(perArrayHeap / 1024).toFixed(2)} KB  <- where the per-stride array lands`,
  )
  console.log(
    `  index / source              ${(perArrayBuffers / sourceBytes).toFixed(2)}x`,
  )
  console.log(
    `  index / all arrays it reads ${(perArrayBuffers / parallelBytes).toFixed(2)}x`,
  )

  // A second hover must REUSE the index, checked by identity rather than by a
  // heap delta: the deltas at this point are dominated by whatever the previous
  // measurement left collectable, and read as large negative numbers that say
  // nothing. Identity is the property that actually matters.
  const reused = arrays.every(a => positionIndexFor(a) === positionIndexFor(a))
  console.log(`  re-hover reuses the index   ${reused ? 'yes' : 'NO'}`)

  // Keep a reference so nothing above is collected early.
  if (arrays.length !== ARRAYS) {
    throw new Error('unreachable')
  }
}
