/* eslint-disable no-console */
// What `MAX_COLUMNS` in buildIdentityMatrix.ts is buying, measured. This is
// what set it to 5000; re-run it before moving it again.
//
// The cap was 512, priced by a docstring reading "at 464 rows the difference
// between 512 columns and 5000 is minutes of worker time for a tree that comes
// out the same" — written 2026-08-17 against @gmod/hclust 5.0.0, a week before
// 5.1.0 took a further 2.5x on the distance build. It is 105 ms, and the tree
// does not come out the same: see measurements/maf-identity-column-cap.json.
//
// This runs `clusterMatrix` — the same call the MAF, variant, wiggle and
// multi-row-feature clustering RPCs all end in — over the row shape
// buildIdentityMatrix emits. No browser: the CPU arm is plain node, so it takes
// enough repetitions to survive this box, which swings ~2x on wall clock under
// load.
//
//     node browser-tests/probe-maf-column-cap.ts [rows] [reps]
//
// Read the ratios between columns, not the milliseconds.
import { clusterMatrix } from '../../../packages/tree-sidebar/src/clusterMatrix.ts'

const ROWS = Number(process.argv[2] ?? 464)
const REPS = Number(process.argv[3] ?? 5)
const COLUMNS = [512, 1000, 2000, 5000, 10000, 20000]

// One per-base truth for the window, at the finest resolution any cap would
// ask for. Every column count below is this same alignment re-binned, which is
// what MAX_COLUMNS actually varies — drawing a fresh random matrix per column
// count instead compares different cohorts and reports no agreement at any
// resolution, which is a property of the generator and not of the cap.
//
// Row 0 is the reference, which self-matches everywhere. The rest carry a
// per-row divergence and dropout runs; the runs are placed per row so that
// which haplotypes drop out where is the structure clustering has to find.
const BASE_COLUMNS = 20000

function truthMatrix(rows: number, seed: number) {
  let s = seed
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
  const conservation = Float32Array.from(
    { length: BASE_COLUMNS },
    () => 0.9 + rnd() * 0.1,
  )
  const rowsOut: Float32Array[] = []
  for (let i = 0; i < rows; i++) {
    const row = new Float32Array(BASE_COLUMNS)
    const divergence = i === 0 ? 0 : rnd() * 0.08
    let dropLeft = 0
    for (let j = 0; j < BASE_COLUMNS; j++) {
      if (i > 0 && dropLeft === 0 && rnd() < 0.0008) {
        dropLeft = 20 + Math.floor(rnd() * 200)
      }
      if (dropLeft > 0) {
        dropLeft--
        row[j] = 0
      } else {
        row[j] = Math.max(0, Math.min(1, conservation[j]! - divergence * rnd()))
      }
    }
    rowsOut.push(row)
  }
  return rowsOut
}

// Re-bin the truth to `columns`, averaging over each bin — the coarse-bin
// counterpart of buildIdentityMatrix dividing a bin's matches by the reference
// positions the bin covers.
function rebin(truth: Float32Array[], columns: number) {
  const width = BASE_COLUMNS / columns
  const out = new Map<string, Float32Array>()
  for (const [i, src] of truth.entries()) {
    const row = new Float32Array(columns)
    for (let b = 0; b < columns; b++) {
      const lo = Math.floor(b * width)
      const hi = Math.floor((b + 1) * width)
      let sum = 0
      for (let k = lo; k < hi; k++) {
        sum += src[k]!
      }
      row[b] = sum / (hi - lo)
    }
    out.set(`hap${i}`, row)
  }
  return out
}

// How much of the row ORDER two column counts agree on. The display consumes
// `order` and nothing else, so this is the question the cap actually turns on:
// adjacency preserved (how often two rows that end up neighbours at one
// resolution are neighbours at the other) plus Spearman on the rank vectors.
function orderAgreement(a: number[], b: number[]) {
  const rankB = new Map(b.map((row, i) => [row, i]))
  const neighboursB = new Set(
    b
      .slice(0, -1)
      .map(
        (row, i) => `${Math.min(row, b[i + 1]!)}:${Math.max(row, b[i + 1]!)}`,
      ),
  )
  let kept = 0
  for (let i = 0; i < a.length - 1; i++) {
    const key = `${Math.min(a[i]!, a[i + 1]!)}:${Math.max(a[i]!, a[i + 1]!)}`
    if (neighboursB.has(key)) {
      kept++
    }
  }
  const n = a.length
  let d2 = 0
  for (const [i, row] of a.entries()) {
    const d = i - rankB.get(row)!
    d2 += d * d
  }
  return {
    adjacency: kept / (a.length - 1),
    spearman: 1 - (6 * d2) / (n * (n * n - 1)),
  }
}

async function main() {
  const truth = truthMatrix(ROWS, 7)
  // The finest binning is the reference every coarser one is scored against:
  // the question the cap turns on is what coarsening LOSES, so 512 cannot be
  // the baseline.
  const finest = await clusterMatrix({
    data: rebin(truth, BASE_COLUMNS),
    statusCallback: () => {},
  })
  console.log(
    `rows=${ROWS}, ${REPS} reps per column count, min reported, ` +
      `agreement against ${BASE_COLUMNS} columns\n`,
  )
  console.log('| columns | min ms | median ms | vs 512 | adjacency | rho |')
  console.log('| ------: | -----: | --------: | -----: | --------: | --: |')
  let baseline = 0
  for (const columns of COLUMNS) {
    const data = rebin(truth, columns)
    // One warm-up: hclust's first call pays the wasm instantiation, which is
    // not what a second viewport move costs.
    const { order } = await clusterMatrix({ data, statusCallback: () => {} })
    const times: number[] = []
    for (let r = 0; r < REPS; r++) {
      const t0 = performance.now()
      await clusterMatrix({ data, statusCallback: () => {} })
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    const min = times[0]!
    const median = times[Math.floor(times.length / 2)]!
    baseline ||= min
    const { adjacency, spearman } = orderAgreement(order, finest.order)
    console.log(
      `| ${columns} | ${min.toFixed(0)} | ${median.toFixed(0)} | ${(min / baseline).toFixed(1)}x | ${(adjacency * 100).toFixed(0)}% | ${spearman.toFixed(3)} |`,
    )
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
