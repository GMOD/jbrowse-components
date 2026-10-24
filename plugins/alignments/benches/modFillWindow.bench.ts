// What the fill view costs at the window the display actually fetches, where a
// long read starts kilobases before the view.
//
//   node --expose-gc plugins/alignments/benches/modFillWindow.bench.ts --start=200000 --end=205000
//   node --expose-gc plugins/alignments/benches/modFillWindow.bench.ts --start=200000 --end=205000 --skip-flag=.
//
// Flags: --rounds=<n> (default 20), --bam=<dir>, --file, --refName, --start,
// --end, --skip-flag=<?|.>, --allow-diff. One region per process.
//
// `modFillView.bench.ts` walks whole reads, so every read's bins start at
// reference offset 0. The display cuts each read to the view
// (`refWindowToRead`). The shipped getMethBins indexed its `number[]` bins by
// the read's own offset, so its first write landed tens of kilobases in and
// V8 put the array into dictionary mode, which `extractMethylation` then
// probed once per base of the view per read. getMethBins now bins into typed
// arrays sized to the window.
//
// On `200x.longread.mod.bam`, 2026-10-22, laptop on AC at load ~20, 15
// rounds, marks identical across arms:
//
//   region              flag   shipped     typed   control
//   200000-205000        ?     106.0 ms    4.80x    0.98x
//   200000-205000        .     215.3 ms    3.16x    0.95x
//   124000-143000        ?     246.0 ms    7.46x    1.00x
//   124000-143000        .     478.2 ms    3.78x    0.97x
//   1-400000 (whole)     ?    2659.0 ms    1.54x    0.93x
//
// ARMS, interleaved, min across rounds, all imported:
//   shipped — number[] bins (modFillWindow.baseline.ts)
//   typed   — production `extractMethylation`
//   control — a second declaration of `shipped`
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { refWindowToRead } from '@jbrowse/cigar-utils'
import { getModPositions } from '@jbrowse/modifications-utils'

import { extractMethylation } from '../src/features/modification/extract.ts'
import { fillControl, fillShipped } from './modFillWindow.baseline.ts'

import type { ModificationEntry } from '../src/shared/webglRpcTypes.ts'
import type { Region } from '@jbrowse/core/util'
import type { ParsedModData } from '@jbrowse/modifications-utils'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '20'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const FILE = arg('file', '200x.longread.mod.bam')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '200000'))
const END = Number(arg('end', '205000'))
const SKIP_FLAG = arg('skip-flag', '?')
const ALLOW_DIFF = process.argv.includes('--allow-diff')

interface Read {
  index: number
  start: number
  strand: -1 | 0 | 1
  data: ParsedModData
}

// `C+m?` -> `C+m` under `--skip-flag=.`, so getMethBins runs its fill walk
function reflag(mm: string, flag: string) {
  return mm
    .split(';')
    .filter(Boolean)
    .map(group => {
      const comma = group.indexOf(',')
      const header = comma === -1 ? group : group.slice(0, comma)
      const rest = comma === -1 ? '' : group.slice(comma)
      const bare = /[.?]$/.test(header) ? header.slice(0, -1) : header
      return (flag === '.' ? bare : bare + flag) + rest
    })
    .join(';')
}

async function loadReads() {
  const path = join(BAM, FILE)
  readFileSync(`${path}.bai`)
  const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  const reads: Read[] = []
  for (let i = 0; i < records.length; i++) {
    const r = records[i]!
    const rawMm = (r.getTag('MM') ?? r.getTag('Mm')) as string | undefined
    const ml = (r.getTag('ML') ?? r.getTag('Ml')) as
      | ArrayLike<number>
      | undefined
    const ops = r.NUMERIC_CIGAR as Uint32Array | undefined
    if (!rawMm || !ml || !ops?.length) {
      continue
    }
    const strand: -1 | 0 | 1 = r.strand === -1 ? -1 : 1
    const seq = r.seq
    const window = refWindowToRead(ops, START - r.start, END - r.start)
    reads.push({
      index: i,
      start: r.start,
      strand,
      data: {
        modifications: getModPositions(
          reflag(rawMm, SKIP_FLAG),
          seq,
          strand,
          window.readStart,
          window.readEnd,
        ),
        probabilities: Array.from(ml, v => (+v + 0.5) / 256),
        cigarOps: ops,
        seq,
        fstrand: strand,
        flen: r.end - r.start,
        window,
      },
    })
  }
  return reads
}

const region = {
  refName: REFNAME,
  start: START,
  end: END,
  assemblyName: 'bench',
} as Region

function driveShipped(reads: Read[]) {
  const out: ModificationEntry[] = []
  for (const r of reads) {
    fillShipped(r.index, r.start, r.strand, START, END, r.data, out)
  }
  return out
}

function driveTyped(reads: Read[]) {
  const out: ModificationEntry[] = []
  for (const r of reads) {
    extractMethylation(r.index, r.start, r.strand, region, r.data, out)
  }
  return out
}

function driveControl(reads: Read[]) {
  const out: ModificationEntry[] = []
  for (const r of reads) {
    fillControl(r.index, r.start, r.strand, START, END, r.data, out)
  }
  return out
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

function lines(marks: ModificationEntry[]) {
  return marks.map(
    m =>
      `${m.readIndex} ${m.position} ${m.modType} ${m.strand} ${m.color} ${m.prob.toFixed(6)} ${m.noMod ? 1 : 0}`,
  )
}

function firstDifference(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return `length ${a.length} vs ${b.length}`
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return `entry ${i}: "${a[i]}" vs "${b[i]}"`
    }
  }
  return ''
}

async function main() {
  const reads = await loadReads()
  const offsets = reads.map(r => r.data.window!.refStart).sort((a, b) => a - b)
  console.log(
    `${FILE} ${REFNAME}:${START}-${END}, skip flag '${SKIP_FLAG}' — ${reads.length} MM reads, median window offset ${offsets[offsets.length >> 1]?.toLocaleString()} bp into the read`,
  )

  const outShipped = driveShipped(reads)
  const outTyped = driveTyped(reads)
  const outControl = driveControl(reads)
  if (outShipped.length === 0) {
    console.error('FAIL: no marks emitted — the fixture cannot produce them')
    process.exit(1)
  }
  const ref = lines(outShipped)
  for (const [name, out] of [
    ['typed', outTyped],
    ['control', outControl],
  ] as const) {
    const diff = firstDifference(lines(out), ref)
    if (diff) {
      console.error(`FAIL: ${name} disagrees with shipped — ${diff}`)
      if (!ALLOW_DIFF) {
        process.exit(1)
      }
    }
  }
  console.log(
    `identity: all arms agree on ${outShipped.length.toLocaleString()} marks`,
  )

  const best = { shipped: Infinity, typed: Infinity, control: Infinity }
  for (let i = 0; i < ROUNDS; i++) {
    best.shipped = Math.min(
      best.shipped,
      time(() => driveShipped(reads)),
    )
    best.typed = Math.min(
      best.typed,
      time(() => driveTyped(reads)),
    )
    best.control = Math.min(
      best.control,
      time(() => driveControl(reads)),
    )
  }
  console.log(`\nmin of ${ROUNDS} rounds:`)
  for (const name of ['shipped', 'typed', 'control'] as const) {
    console.log(
      `  ${name.padEnd(8)} ${best[name].toFixed(2).padStart(9)} ms   ${(best.shipped / best[name]).toFixed(3)}x`,
    )
  }
}

await main()
