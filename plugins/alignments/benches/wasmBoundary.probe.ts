// Probe, not a bench: what would it COST to hand each read to WebAssembly?
//
//   node --expose-gc plugins/alignments/benches/wasmBoundary.probe.ts
//
// Flags: --rounds=<n> (default 15), --bam=<dir>, --file, --refName, --start, --end
//
// A wasm kernel for the MM delta walk is attractive for one specific reason: the
// reverse walk is slow because V8 has no fast backward byte search, and `v128`
// does. `revCompScan.bench.ts` shows the JS ways around that are a trade — the
// one that wins (`hits`) buys it with an array of ~seqLength/4 transient numbers,
// and the allocation-free version (`backward`) needs two scans and loses.
//
// But wasm cannot scan a JS string. The read has to be copied into linear memory
// first, and that copy is O(read length) — which is exactly what killed the
// revcomp arms, whose build loop is also O(read length). So the question that
// decides whether a wasm kernel could ever pay is: **is the copy cheap enough to
// disappear, or is it another full pass?**
//
// The copy is not the same shape as the revcomp build, which is why it is worth
// measuring rather than assuming. `TextEncoder.encodeInto` is native and writes
// straight into a preallocated view; the revcomp build was a JS loop doing a
// charCodeAt, a table lookup and a store per base. This times the former against
// the reverse walk it would have to be a rounding error against.
//
// It measures the FLOOR, not a wasm implementation: encodeInto is the cheapest
// the boundary can possibly be, and a real module also pays a call per group and
// whatever the scan itself costs. If the floor is already a large fraction of the
// walk, there is no version of this that pays.
//
// WHAT IT SAYS, 2026-08-14, ont.6ma.chr20, 4,107 reverse reads / 36.5 Mbp:
//
//   stepWalk (ships)        160.71 ms
//   encodeInto only          32.45 ms   20.2% of the walk it would precede
//   encodeInto + byte walk  146.16 ms   1.099x vs the walk
//
// **The boundary is ~20% of the budget, so wasm has ~80% to compress**, and it
// is real headroom: `v128` has 16-byte compare instructions and the walk is a
// byte search. Take the copy as free and a SIMD scan as 4-8x the scalar one and
// the reverse walk lands somewhere near 2-3x.
//
// **That is not enough to justify it, because JS already got most of it.**
// `revCompScan.bench.ts`'s `hitsArena` is **1.37x-1.76x** on the same phase with
// no module, no build step, and no linear memory — and the wasm figure above is
// a ceiling assembled from two optimistic assumptions, against a measurement.
// The honest comparison is a maybe-2x that has to be built, shipped and carried
// against a measured 1.4-1.8x that is forty lines.
//
// **And the carrying cost is known here rather than hypothetical.**
// ARCHITECTURAL_LIMITS.md's entry on the inflate pool is 20 workers each holding
// their own grow-only `WebAssembly.Memory`, invisible to `Runtime.getHeapUsage`.
// A second module multiplies that again, for a walk that is a fraction of one
// phase of one adapter's parse.
//
// So: not a no forever, but not this. `MAF_WORKER_PIPELINE.md` already says the
// first wasm kernel needs more than one customer to amortize the build step, and
// after this the mod path is a WEAKER customer than it looked, not a stronger
// one — the cheap JS win took the margin that would have justified it.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '15'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const FILE = arg('file', 'ont.6ma.chr20.bam')
const REFNAME = arg('refName', 'chr20')
const START = Number(arg('start', '1'))
const END = Number(arg('end', '100000000'))

const path = join(BAM, FILE)
try {
  readFileSync(path, { flag: 'r' })
} catch {
  console.log(`not present at ${path}, nothing to measure`)
  process.exit(0)
}
const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
await bam.getHeader()
const records = await bam.getRecordsForRange(REFNAME, START, END)

interface R {
  seq: string
  deltas: number[]
  target: number
}
const reads: R[] = []
for (const r of records) {
  const mm = (r.getTag('MM') ?? r.getTag('Mm')) as string | undefined
  if (!mm || r.strand !== -1) {
    continue
  }
  const group = mm.split(';').find(Boolean)
  if (!group) {
    continue
  }
  const split = group.split(',')
  reads.push({
    seq: r.seq,
    deltas: split.slice(1).map(Number),
    // complement of C, since these fixtures are cytosine-called
    target: 71,
  })
}
if (reads.length === 0) {
  console.log('no reverse-strand MM reads in range')
  process.exit(0)
}

const bases = reads.reduce((a, r) => a + r.seq.length, 0)
const maxLen = reads.reduce((a, r) => Math.max(a, r.seq.length), 0)

// One buffer, grown once, reused for every read — the arrangement a wasm module
// would use (its linear memory is grow-only and persistent).
const scratch = new Uint8Array(maxLen)
const encoder = new TextEncoder()

// THE BOUNDARY: what it costs just to get the bytes somewhere wasm could read.
function copyOnly() {
  let sink = 0
  for (const r of reads) {
    const { written } = encoder.encodeInto(r.seq, scratch)
    sink += written
  }
  return sink
}

// THE WALK IT WOULD REPLACE: the shipped reverse stepping walk, one group.
function stepWalk() {
  let sink = 0
  for (const r of reads) {
    const seq = r.seq
    const seqLength = seq.length
    let currPos = 0
    for (let i = 0; i < r.deltas.length; i++) {
      if (currPos >= seqLength) {
        sink += 0
        continue
      }
      let delta = r.deltas[i]!
      do {
        if (seq.charCodeAt(seqLength - 1 - currPos) === r.target) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < seqLength)
      sink += seqLength - currPos
    }
  }
  return sink
}

// A CEILING ON WHAT WASM COULD WIN: the copy, plus a backward scan over the
// bytes doing the least work a correct scan can do. Not SIMD — a scalar loop
// over a typed array — so a real v128 kernel would sit somewhere between
// `copyOnly` and this.
function copyAndScan() {
  let sink = 0
  for (const r of reads) {
    const { written } = encoder.encodeInto(r.seq, scratch)
    let currPos = 0
    for (let i = 0; i < r.deltas.length; i++) {
      if (currPos >= written) {
        continue
      }
      let delta = r.deltas[i]!
      do {
        if (scratch[written - 1 - currPos] === r.target) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < written)
      sink += written - currPos
    }
  }
  return sink
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

let bestCopy = Infinity
let bestStep = Infinity
let bestBoth = Infinity
for (let i = 0; i < ROUNDS; i++) {
  const order = [
    () => {
      bestCopy = Math.min(bestCopy, time(copyOnly))
    },
    () => {
      bestStep = Math.min(bestStep, time(stepWalk))
    },
    () => {
      bestBoth = Math.min(bestBoth, time(copyAndScan))
    },
  ]
  for (let j = 0; j < order.length; j++) {
    order[(i + j) % order.length]!()
  }
}

console.log(
  `wasm boundary probe — ${FILE}, reverse strand, one MM group per read\n` +
    `  ${reads.length} reads, ${(bases / 1e6).toFixed(2)} Mbp, longest ${maxLen} bp\n\n` +
    `  stepWalk (ships)        ${bestStep.toFixed(2).padStart(8)} ms\n` +
    `  encodeInto only         ${bestCopy.toFixed(2).padStart(8)} ms   ` +
    `${((bestCopy / bestStep) * 100).toFixed(1)}% of the walk it would precede\n` +
    `  encodeInto + byte walk  ${bestBoth.toFixed(2).padStart(8)} ms   ` +
    `${(bestStep / bestBoth).toFixed(3)}x vs the walk\n\n` +
    `  So the boundary alone spends ${((bestCopy / bestStep) * 100).toFixed(1)}% of the budget before\n` +
    `  any wasm runs, and a scalar byte walk on the other side of it is ` +
    `${(bestStep / bestBoth).toFixed(3)}x.\n`,
)
