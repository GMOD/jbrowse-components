// A/B `computeMafCoverage` in the working tree against the same function from
// another git ref, over synthetic wire of a controlled shape.
//
//   node --expose-gc plugins/maf/benches/mafCoverage.bench.ts
//   node --expose-gc plugins/maf/benches/mafCoverage.bench.ts --base=HEAD~1
//
// Flags: --base=<ref> (default main), --rounds=<n> (default 12), --allow-diff
//
// Four things here are not decoration. The first three are general and are
// written up once, with the fake numbers they produced, in
// `agent-docs/reference/BENCHMARKING.md` — read that before writing a new bench
// rather than reverse-engineering it from this one. Repeated here because this
// file has to be readable on its own; the fourth is specific to coverage.
//
// INTERLEAVING AND MIN. Sides run round-robin in one process and the reported
// number is the MIN across rounds, not the mean. On a machine doing other work
// the mean of this comparison wandered between 1.04x and 1.39x for the *same*
// change across three runs; the min-of-interleaved-rounds does not.
//
// A CONTROL. The third side is the baseline ref extracted a second time into a
// second directory: byte-identical code, separately loaded and separately
// optimized. Whatever it scores against the baseline is this harness's own
// floor, and a ratio claimed for the working tree has to clear it. That is not
// hypothetical here — the control read 0.84x and 1.20x on a busy machine, so a
// row whose control is far from 1.00 is a row that measured nothing. It costs
// one extra timing side and it is the difference between a result and a story.
//
// AN IDENTITY CHECK. Every output column — depths, identity, both mismatch
// arrays, both insertion fields, maxDepth — is compared before any timing is
// believed, since a faster coverage that reports different depths is not a
// faster coverage. NaN compares equal to itself here: it is a real value in
// `identity`, meaning no classifiable base at that position.
//
// SYNTHETIC INPUT, ON PURPOSE. A real MAF pins one shape; the cost of this
// function turned out to depend on shape (rows per block, columns per block,
// and whether rows are ragged) far more than on content, so the generator below
// sweeps those directly. The last two rows drive rows SHORTER than their block
// reference, which is the defensive path — it must stay correct, and it is the
// one shape the per-block hoist cannot help.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')

interface CoverageResult {
  depths: Float32Array
  maxDepth: number
  mismatchPositions: Uint32Array
  mismatchBases: Uint8Array
  insertions: { position: number; length: number }[]
  identity: Float32Array
}

type CoverageFn = (
  data: unknown,
  regionStart: number,
  regionEnd: number,
  refSampleId?: string,
) => CoverageResult

const MODULE_PATH =
  'plugins/maf/src/LinearMafGetAlignmentDataRpc/computeMafCoverage.ts'

function toCoverage(mod: object, label: string): CoverageFn {
  if (
    'computeMafCoverage' in mod &&
    typeof mod.computeMafCoverage === 'function'
  ) {
    return mod.computeMafCoverage as CoverageFn
  }
  throw new Error(`${label} has no computeMafCoverage export`)
}

// Whole-package checkout, not a single file: a baseline that imported the
// working tree's `asciiBytes` would be a chimera of both revisions.
async function loadRef(baseRef: string, label: string) {
  const dir = mkdtempSync(join(tmpdir(), 'jb-mafcov-'))
  const tar = execFileSync('git', ['archive', baseRef, '--', 'plugins/maf'], {
    cwd: root,
    maxBuffer: 1 << 28,
    encoding: 'buffer',
  })
  execFileSync('tar', ['-x', '-C', dir], { input: tar })
  return { fn: toCoverage(await import(join(dir, MODULE_PATH)), label), dir }
}

// --- synthetic wire -------------------------------------------------------

const BASES = 'ACGT'
const enc = new TextEncoder()

interface Shape {
  name: string
  rows: number
  cols: number
  /** every Nth reference column is a gap, driving the insertion path */
  refGapEvery?: number
  /** every Nth cell mismatches its reference base */
  mismatchEvery?: number
  /** every Nth cell is an alignment gap in a sample row */
  rowGapEvery?: number
  /** every Nth row is half length, forcing the block onto the ragged path */
  raggedEvery?: number
  /** every Nth reference column is an N, which is unclassifiable */
  refNEvery?: number
  /** every Nth sample base is soft-masked lowercase, as real MAF mostly is */
  lowerEvery?: number
}

const CELLS = 9e6

function makeWire(s: Shape) {
  const nBlocks = Math.max(1, Math.round(CELLS / (s.rows * s.cols)))
  const sampleIds = Array.from({ length: s.rows }, (_, i) => `species${i}`)
  const chunks: Uint8Array[] = []
  const rowOffset: number[] = []
  const rowLength: number[] = []
  const rowSample: number[] = []
  const blockStartBp: number[] = []
  const blockRefOffset: number[] = []
  const blockRefLength: number[] = []
  const blockRowStart: number[] = []
  let off = 0
  let bp = 0
  const every = (n: number | undefined, k: number) =>
    n !== undefined && n > 0 && k % n === 0
  const push = (str: string) => {
    const b = enc.encode(str)
    chunks.push(b)
    const at = off
    off += b.length
    return at
  }
  for (let b = 0; b < nBlocks; b++) {
    let ref = ''
    for (let i = 0; i < s.cols; i++) {
      ref += every(s.refGapEvery, b + i)
        ? '-'
        : every(s.refNEvery, b + i)
          ? 'N'
          : BASES[(b + i) % 4]!
    }
    blockRowStart.push(rowOffset.length)
    blockStartBp.push(bp)
    blockRefOffset.push(push(ref))
    blockRefLength.push(ref.length)
    for (let r = 0; r < s.rows; r++) {
      const n = every(s.raggedEvery, r + b) ? Math.max(1, s.cols >> 1) : s.cols
      let row = ''
      for (let i = 0; i < n; i++) {
        let c = every(s.rowGapEvery, i + r)
          ? '-'
          : every(s.mismatchEvery, i * 7 + r * 13 + b)
            ? BASES[(b + i + 1) % 4]!
            : ref[i]!
        if (every(s.lowerEvery, i + r * 3)) {
          c = c.toLowerCase()
        }
        row += c
      }
      rowOffset.push(push(row))
      rowLength.push(row.length)
      rowSample.push(r)
    }
    bp += ref.replaceAll('-', '').length
  }
  blockRowStart.push(rowOffset.length)
  const arena = new Uint8Array(off)
  let p = 0
  for (const c of chunks) {
    arena.set(c, p)
    p += c.length
  }
  return {
    data: {
      arena,
      rowOffset: new Uint32Array(rowOffset),
      rowLength: new Uint32Array(rowLength),
      rowSample: new Uint32Array(rowSample),
      blockStartBp: new Uint32Array(blockStartBp),
      blockRefOffset: new Uint32Array(blockRefOffset),
      blockRefLength: new Uint32Array(blockRefLength),
      blockRowStart: new Uint32Array(blockRowStart),
      sampleIds,
    },
    regionEnd: bp,
    nBlocks,
    cells: nBlocks * s.cols * s.rows,
  }
}

// --- identity -------------------------------------------------------------

// Describes the first differing value rather than just flagging one, so a
// deliberate change (say, insertions starting to clamp differently) reads as
// what it is instead of an unexplained failure.
function firstDifference(a: CoverageResult, b: CoverageResult) {
  const cmp = (name: string, x: ArrayLike<number>, y: ArrayLike<number>) => {
    if (x.length !== y.length) {
      return `${name} length ${x.length} vs ${y.length}`
    }
    for (let i = 0; i < x.length; i++) {
      const xi = x[i]!
      const yi = y[i]!
      if (xi !== yi && !(Number.isNaN(xi) && Number.isNaN(yi))) {
        return `${name}[${i}]: ${xi} vs ${yi}`
      }
    }
    return undefined
  }
  return (
    cmp('depths', a.depths, b.depths) ??
    cmp('identity', a.identity, b.identity) ??
    cmp('mismatchPositions', a.mismatchPositions, b.mismatchPositions) ??
    cmp('mismatchBases', a.mismatchBases, b.mismatchBases) ??
    cmp(
      'insertion position',
      a.insertions.map(i => i.position),
      b.insertions.map(i => i.position),
    ) ??
    cmp(
      'insertion length',
      a.insertions.map(i => i.length),
      b.insertions.map(i => i.length),
    ) ??
    (a.maxDepth === b.maxDepth
      ? undefined
      : `maxDepth ${a.maxDepth} vs ${b.maxDepth}`)
  )
}

// --- shapes ---------------------------------------------------------------

const SHAPES: Shape[] = [
  // the UCSC ce11 26-way: many tiny blocks, which is the shape the RPC profile
  // that started this was taken over
  {
    name: 'ce11 26-way, 7bp blocks',
    rows: 26,
    cols: 7,
    refGapEvery: 29,
    mismatchEvery: 17,
    rowGapEvery: 53,
    lowerEvery: 3,
  },
  {
    name: 'ce11 26-way, 70bp blocks',
    rows: 26,
    cols: 70,
    refGapEvery: 29,
    mismatchEvery: 17,
    rowGapEvery: 53,
    lowerEvery: 3,
  },
  // a deep alignment: the inner row loop is long
  {
    name: 'deep 447-way, 200bp blocks',
    rows: 447,
    cols: 200,
    refGapEvery: 31,
    mismatchEvery: 17,
    rowGapEvery: 53,
    lowerEvery: 3,
  },
  {
    name: 'deep 447-way, 8kbp blocks',
    rows: 447,
    cols: 8000,
    refGapEvery: 31,
    mismatchEvery: 17,
    rowGapEvery: 53,
    lowerEvery: 3,
  },
  // content extremes at one shape, to show cost tracks shape and not content
  { name: '30-way, no gaps at all', rows: 30, cols: 500 },
  {
    name: '30-way, N refs + soft mask',
    rows: 30,
    cols: 500,
    refNEvery: 23,
    mismatchEvery: 17,
    lowerEvery: 2,
  },
  // Insertion-heavy: a reference gap column takes the *other* per-cell loop,
  // the one that accumulates pending insertion runs. Every shape above spends
  // ~3% of its columns there, which is realistic but far too little to see that
  // loop at all — these two exist so a change to it is measurable rather than
  // assumed. Indel-dense alignments really do reach these rates locally.
  {
    name: '30-way, 1 ref col in 8 a gap',
    rows: 30,
    cols: 500,
    refGapEvery: 8,
    mismatchEvery: 17,
    rowGapEvery: 53,
    lowerEvery: 3,
  },
  {
    name: '30-way, 1 ref col in 3 a gap',
    rows: 30,
    cols: 500,
    refGapEvery: 3,
    mismatchEvery: 17,
    rowGapEvery: 53,
    lowerEvery: 3,
  },
  // the defensive path: rows shorter than their block reference
  {
    name: '30-way, 1 row in 3 truncated',
    rows: 30,
    cols: 500,
    raggedEvery: 3,
    refGapEvery: 31,
    mismatchEvery: 17,
    rowGapEvery: 53,
  },
  {
    name: '30-way, 1 row in 30 truncated',
    rows: 30,
    cols: 500,
    raggedEvery: 30,
    refGapEvery: 31,
    mismatchEvery: 17,
    rowGapEvery: 53,
  },
]

// --- run ------------------------------------------------------------------

const baseRef =
  process.argv.find(a => a.startsWith('--base='))?.slice('--base='.length) ??
  'main'
const rounds = Number(
  process.argv
    .find(a => a.startsWith('--rounds='))
    ?.slice('--rounds='.length) ?? 12,
)

const current = toCoverage(
  await import(join(root, MODULE_PATH)),
  'working tree',
)
const base = await loadRef(baseRef, baseRef)
const control = await loadRef(baseRef, `${baseRef} (control)`)

console.log(
  `working tree vs ${baseRef}, min of ${rounds} interleaved rounds\n` +
    `control is ${baseRef} loaded a second time: its ratio is the noise floor,\n` +
    `and a row whose control is not near 1.00 did not measure anything\n`,
)
let failed = false
try {
  for (const shape of SHAPES) {
    const w = makeWire(shape)
    const run = (f: CoverageFn) => f(w.data, 0, w.regionEnd, 'species0')
    const diff = firstDifference(run(current), run(base.fn))
    if (diff) {
      failed = true
    }

    const sides = [
      ['baseline', base.fn],
      ['control', control.fn],
      ['current', current],
    ] as const
    const best = { baseline: Infinity, control: Infinity, current: Infinity }
    for (let round = 0; round < rounds; round++) {
      for (const [name, fn] of sides) {
        globalThis.gc?.()
        const t0 = performance.now()
        run(fn)
        best[name] = Math.min(best[name], performance.now() - t0)
      }
    }
    console.log(
      `${shape.name}\n` +
        `  ${w.nBlocks.toLocaleString()} blocks, ${(w.cells / 1e6).toFixed(1)}M cells, ` +
        `output ${diff ? `DIFFERS — ${diff}` : 'identical'}\n` +
        `  ${baseRef.padEnd(12)} ${best.baseline.toFixed(2).padStart(8)} ms\n` +
        `  control      ${best.control.toFixed(2).padStart(8)} ms   ${(best.baseline / best.control).toFixed(3)}x\n` +
        `  working tree ${best.current.toFixed(2).padStart(8)} ms   ${(best.baseline / best.current).toFixed(3)}x\n`,
    )
  }
} finally {
  rmSync(base.dir, { recursive: true, force: true })
  rmSync(control.dir, { recursive: true, force: true })
}

if (failed && !process.argv.includes('--allow-diff')) {
  console.error(
    'The two sides report different coverage. If that is deliberate — the\n' +
      'change above is one you meant to make — rerun with --allow-diff.\n' +
      'Otherwise the timings are comparing two different computations.',
  )
  process.exitCode = 1
}
