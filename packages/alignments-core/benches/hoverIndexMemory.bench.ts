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
// WHAT IT SAYS. 40 arrays, 2026-08-14:
//
//   longread-400k   index 3.05 MB/array  8.00 B/entry  2.00x source  0.57x parallel
//   shortread-40k   index 0.19 MB/array  5.00 B/entry  1.25x source  0.36x parallel
//   deep-1m         index 7.62 MB/array  7.99 B/entry  2.00x source  0.57x parallel
//
// Theory is 8 B/entry exactly — `order` and `sorted` are both `Uint32Array(n)` —
// and the two large fixtures land on it. **The 40k row is below this method's
// floor**, not a real 5 B/entry: at 320 KB expected per array the deltas are
// comparable to what the previous measurement left collectable. Read the two
// large rows; size the fixture up rather than trusting a small one.
//
// So the index is 2x the positions array it indexes and 0.57x the whole parallel
// mismatch set it makes usable (14 B/entry — positions u32, Ys u16, bases u8,
// strands i8, readIndices u32, frequencies u8, quals u8). `positionIndex.ts`
// claims "a fraction of what it makes usable" and that is right, but only
// against the full set: against `mismatchPositions` alone it DOUBLES it.
//
// The number that matters for a decision is neither ratio, it is the absolute:
// 7.6 MB per 1M-entry array, retained per region, per stacked track, invisibly.
// Read it against hoverIndex.bench.ts's 3099x/5988x on long reads before
// concluding either way.
//
// The `index JS heap (objects)` line is what a per-stride COLLECTION beside the
// index would cost, and is why the stride is carried on the index instead: ~24
// bytes/array either way, i.e. under the noise, so the version that allocates
// nothing extra wins by default rather than by measurement.

import { positionIndexFor } from '../src/positionIndex.ts'

const ARRAYS = Number(
  process.argv.find(a => a.startsWith('--arrays='))?.slice(9) ?? 40,
)
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7)

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
