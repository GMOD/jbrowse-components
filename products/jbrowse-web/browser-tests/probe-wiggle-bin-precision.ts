/* eslint-disable no-console */
// What f32 accumulation costs `getScoreMatrix`'s column binning, and whether it
// reaches the cluster order.
//
// `addSpan` sums into a `Float32Array` and divides by a per-column count, and
// its own comment says a column holds hundreds of a bedMethyl's CpGs at 10
// kb/px. That is naive f32 summation with no compensation — hclust's distance
// build promotes to f64 every 16 elements, and this has no counterpart.
//
// Three arms, same data: f32 sums (what ships), f64 sums stored back to f32
// (accumulate wide, keep the wire narrow), and f64 throughout as the reference.
// Reports the worst per-column relative error and whether the row ORDER the
// clusterer returns actually moves, which is the only part a user sees.
//
//     node browser-tests/probe-wiggle-bin-precision.ts [rows] [columns] [perColumn]
//
// `perColumn` is how many features land in one column — 1 for a tiling BigWig
// at base resolution, hundreds for a bedMethyl zoomed out.
import { clusterMatrix } from '../../../packages/tree-sidebar/src/clusterMatrix.ts'

const ROWS = Number(process.argv[2] ?? 40)
const COLUMNS = Number(process.argv[3] ?? 2000)
const PER_COLUMN = Number(process.argv[4] ?? 500)

// Score distributions worth separating: a methylation percentage sits in a
// narrow band where f32 has plenty of mantissa, while a coverage track spans
// orders of magnitude within one column and is where absorption bites.
const SHAPES = {
  methylation: (rnd: () => number) => rnd() * 100,
  coverage: (rnd: () => number) => 10 ** (rnd() * 6),
  smallOnBig: (rnd: () => number) => (rnd() < 0.02 ? 1e7 : rnd() * 10),
}

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

// The three arms of one row's binning, over identical scores.
function binRow(
  columns: number,
  perColumn: number,
  score: () => number,
): { f32: Float32Array; wide: Float32Array; f64: Float64Array } {
  const f32sums = new Float32Array(columns)
  const f64sums = new Float64Array(columns)
  for (let c = 0; c < columns; c++) {
    for (let k = 0; k < perColumn; k++) {
      const v = score()
      // Exactly `addSpan`: read, add, write back, in the array's own precision.
      f32sums[c] = f32sums[c]! + v
      f64sums[c] = f64sums[c]! + v
    }
  }
  const f32 = new Float32Array(columns)
  const wide = new Float32Array(columns)
  const f64 = new Float64Array(columns)
  for (let c = 0; c < columns; c++) {
    f32[c] = f32sums[c]! / perColumn
    wide[c] = f64sums[c]! / perColumn
    f64[c] = f64sums[c]! / perColumn
  }
  return { f32, wide, f64 }
}

function maxRelErr(got: ArrayLike<number>, ref: ArrayLike<number>) {
  let worst = 0
  for (let i = 0; i < ref.length; i++) {
    const r = ref[i]!
    if (r !== 0) {
      worst = Math.max(worst, Math.abs(got[i]! - r) / Math.abs(r))
    }
  }
  return worst
}

function orderDiff(a: number[], b: number[]) {
  let moved = 0
  for (const [i, row] of a.entries()) {
    if (row !== b[i]) {
      moved++
    }
  }
  return moved
}

async function main() {
  console.log(
    `rows=${ROWS} columns=${COLUMNS} features per column=${PER_COLUMN}\n`,
  )
  console.log(
    '| scores | f32 sums, max rel err | f64 sums -> f32, max rel err | rows moved (f32 vs f64) |',
  )
  console.log(
    '| --- | --------------------: | ---------------------------: | ----------------------: |',
  )
  for (const [label, shape] of Object.entries(SHAPES)) {
    const f32rows = new Map<string, Float32Array>()
    const widerows = new Map<string, Float32Array>()
    const f64rows = new Map<string, Float64Array>()
    let worstF32 = 0
    let worstWide = 0
    for (let r = 0; r < ROWS; r++) {
      // Same seed per row across arms: the three differ only in accumulator
      // width, never in the values summed.
      const rnd = makeRng(1000 + r)
      const { f32, wide, f64 } = binRow(COLUMNS, PER_COLUMN, () => shape(rnd))
      worstF32 = Math.max(worstF32, maxRelErr(f32, f64))
      worstWide = Math.max(worstWide, maxRelErr(wide, f64))
      f32rows.set(`row${r}`, f32)
      widerows.set(`row${r}`, wide)
      f64rows.set(`row${r}`, f64)
    }
    const a = await clusterMatrix({ data: f32rows, statusCallback: () => {} })
    const b = await clusterMatrix({
      data: f64rows,
      statusCallback: () => {},
    })
    console.log(
      `| ${label} | ${worstF32.toExponential(1)} | ${worstWide.toExponential(1)} | ${orderDiff(a.order, b.order)} of ${ROWS} |`,
    )
  }
}

main().catch((e: unknown) => {
  console.error(e)
  process.exit(1)
})
