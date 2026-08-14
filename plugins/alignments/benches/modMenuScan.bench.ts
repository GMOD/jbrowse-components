// What a modBAM costs when it is NOT coloured by modifications.
//
//   node --expose-gc plugins/alignments/benches/modMenuScan.bench.ts --only=200x
//
// Flags: --rounds=<n> (default 30), --bam=<path>, --refName, --start, --end,
// --only=<fixture substring>
//
// The harness rules are in agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. Opening a modBAM does not mean colouring by modifications —
// the track opens in normal colouring and the reads carry MM/ML regardless. But
// `extractModifications` ran its whole per-read pipeline on every render
// anyway, because two things downstream want to know WHICH modification types
// the data carries: `detectedModifications` (what the menu offers) and
// `seenModTypes` (which the caller resolves into simplex/duplex).
//
// Neither wants a position. Both are answered by the MM tag's HEADERS — the
// `C+m` before the first comma — while the work was `getModPositions`, which
// walks the tag's delta list against the READ SEQUENCE, making BAM decode SEQ
// for every read to do it.
//
// THREE ARMS, one a control:
//   full     — what shipped: getModPositions(mm, seq, strand), then read the
//              type off each parsed group
//   headers  — getModTypes(mm): split on ';', parse each header, done. No
//              sequence, no delta walk
//   control  — a second, separately-declared copy of `full`
//
// Note what the `full` arm does NOT include, so the number is not flattered:
// the ML tag read, the CIGAR pack, and the max-probability walk are all left
// out of both arms. Those are gated on modifications mode now too, so the real
// saving on this path is larger than what is measured here.
//
// WHAT IT SAYS on `200x.longread.mod.bam` (285 MM reads), `--rounds=20`:
//
//   full parse    127.31 ms
//   MM headers      0.22 ms   584x   output identical
//   control       124.11 ms   1.026x
//
// 584x is not a close call, and the reason it is that large rather than merely
// large is that the two arms are not doing the same amount of work in different
// ways — one walks every delta in the tag against the read sequence and the
// other reads a handful of characters per group. The right comparison for
// "should this be gated" is the absolute 127 ms, per render, for a menu.
//
// See modExtract.bench.ts for the sibling number on the drawing path, which is
// what still runs when the track IS coloured by modifications.
//
// Written out longhand. Do NOT refactor the arms into one driver parameterized
// by a flag — see BENCHMARKING.md's polymorphism trap.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'
import { getModPositions, getModTypes } from '@jbrowse/modifications-utils'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '30'))
const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
const ONLY = arg('only', '')

// ARM 1: full — the parse as it ran before, including the read sequence it
// walks against. `seq` is read INSIDE the timed region on purpose: on a BAM
// record that is a decode, and skipping it is most of what the change buys.
function runFull(
  records: { mm: string; record: { seq: string; strand: number } }[],
) {
  const detected = new Set<string>()
  const seen = new Map<string, { type: string; base: string; strand: string }>()
  for (const r of records) {
    const strand = r.record.strand === -1 ? -1 : 1
    for (const m of getModPositions(r.mm, r.record.seq, strand)) {
      detected.add(m.type)
      const key = m.strand + m.type
      if (!seen.has(key)) {
        seen.set(key, { type: m.type, base: m.base, strand: m.strand })
      }
    }
  }
  return { detected, seen }
}

// ARM 2: headers
function runHeaders(
  records: { mm: string; record: { seq: string; strand: number } }[],
) {
  const detected = new Set<string>()
  const seen = new Map<string, { type: string; base: string; strand: string }>()
  for (const r of records) {
    for (const m of getModTypes(r.mm)) {
      detected.add(m.type)
      const key = m.strand + m.type
      if (!seen.has(key)) {
        seen.set(key, { type: m.type, base: m.base, strand: m.strand })
      }
    }
  }
  return { detected, seen }
}

// ARM 3: control — a second, separately-declared copy of ARM 1.
function runControl(
  records: { mm: string; record: { seq: string; strand: number } }[],
) {
  const detected = new Set<string>()
  const seen = new Map<string, { type: string; base: string; strand: string }>()
  for (const r of records) {
    const strand = r.record.strand === -1 ? -1 : 1
    for (const m of getModPositions(r.mm, r.record.seq, strand)) {
      detected.add(m.type)
      const key = m.strand + m.type
      if (!seen.has(key)) {
        seen.set(key, { type: m.type, base: m.base, strand: m.strand })
      }
    }
  }
  return { detected, seen }
}

function serialize(out: ReturnType<typeof runFull>) {
  return [
    [...out.detected].sort().join(','),
    [...out.seen.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${k}:${v.type}/${v.base}/${v.strand}`)
      .join(','),
  ]
}

function firstDifference(a: string[], b: string[]) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      return `line ${i}: "${a[i]}" vs "${b[i]}"`
    }
  }
  return ''
}

function time(fn: () => unknown) {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const datasets = [
    { name: '20x.longread.mod.bam', file: '20x.longread.mod.bam' },
    { name: '200x.longread.mod.bam', file: '200x.longread.mod.bam' },
  ].filter(d => d.name.includes(ONLY))
  console.log(
    `modification MENU scan: full parse vs MM headers\n` +
      `${REFNAME}:${START}-${END}, min of ${ROUNDS} rotated rounds\n`,
  )
  for (const ds of datasets) {
    const path = join(BAM, ds.file)
    try {
      readFileSync(path, { flag: 'r' })
    } catch {
      console.log(`${ds.name}: not present at ${path}, skipped\n`)
      continue
    }
    const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
    await bam.getHeader()
    const raw = await bam.getRecordsForRange(REFNAME, START, END)
    const records = raw
      .map(record => ({
        mm: (record.getTag('MM') ?? record.getTag('Mm')) as string | undefined,
        record,
      }))
      .filter((r): r is { mm: string; record: (typeof raw)[number] } => !!r.mm)
    if (records.length === 0) {
      console.log(`${ds.name}: no MM reads in range, skipped\n`)
      continue
    }

    const outFull = serialize(runFull(records))
    const outHeaders = serialize(runHeaders(records))
    const outControl = serialize(runControl(records))
    const diffHeaders = firstDifference(outFull, outHeaders)
    const diffControl = firstDifference(outFull, outControl)
    if (diffControl) {
      throw new Error(
        `the control disagrees with the baseline it was copied from (${diffControl}) — the harness is broken`,
      )
    }

    const best = { full: Infinity, headers: Infinity, ctl: Infinity }
    const sides = [
      { k: 'full' as const, run: () => runFull(records) },
      { k: 'headers' as const, run: () => runHeaders(records) },
      { k: 'ctl' as const, run: () => runControl(records) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const x = (v: number) => `${(best.full / v).toFixed(3)}x`
    console.log(
      `${ds.name}\n` +
        `  ${records.length} MM reads, types found: ${outFull[0]}\n` +
        `  full parse      ${best.full.toFixed(2).padStart(8)} ms\n` +
        `  MM headers      ${best.headers.toFixed(2).padStart(8)} ms   ${x(best.headers)}   ` +
        `output ${diffHeaders ? `DIFFERS — ${diffHeaders}` : 'identical'}\n` +
        `  control         ${best.ctl.toFixed(2).padStart(8)} ms   ${x(best.ctl)}   <- noise floor\n`,
    )
  }
}

await main()
