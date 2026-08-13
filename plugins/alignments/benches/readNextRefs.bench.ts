// What did the last two per-read string arrays cost?
//
//   node --expose-gc plugins/alignments/benches/readNextRefs.bench.ts --only=1000x
//
// Flags: --rounds=<n> (default 15), --data=<dir>, --only=<fixture substring>
//
// ONE FIXTURE PER PROCESS — agent-docs/reference/BENCHMARKING.md.
//
// After `readIds` and `readNames`, two `string[]`s were left that a pileup pays
// for on EVERY fetch, and they turned out to be waste of two different kinds.
//
// `readNextRefs` — the mate's reference name per read. On the deepest window
// that array holds ONE distinct value across 153,677 entries: every mate is on
// the same contig. It was `refIdToName` per read manufacturing a string from a
// number the record already holds, then cloning the result by object count.
// It ships as slots into a table of the distinct names instead.
//
// `readSuppAlignments` — the SA tag per read. `getTag(feature, 'SA')` walks the
// read's whole tag block, and on this fixture SA is present on ZERO reads. Its
// only consumer is the arc computation, which does nothing while connections
// are off — so the worker now skips it, gated on `readConnections` in rpcProps
// (the same trade `showCoverage` makes: skip real work, accept a refetch).
//
// ARMS + a control:
//   nr-build-str   — what shipped: a refName per read into a string[]
//   nr-post-str    — structuredClone of it (what postMessage does)
//   nr-build-PROD  — the REAL `buildReadNextRefs`, over features shaped like
//                    `BamSlightlyLazyFeature` (a `nextRefId` getter). Built
//                    once outside the clock; a bench that allocates its own
//                    input inside the timed region measures the harness
//   nr-post-table  — the slots transferred, plus the name table
//   sa-build       — `getTag('SA')` per read into a string[]
//   sa-post        — structuredClone of it
//   control        — a second, separately-declared copy of nr-build-str
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

import { buildReadNextRefs } from '../src/shared/readNextRefs.ts'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '15'))
const DATA = arg('data', join(process.env.HOME!, 'src/jb2bench/data'))
const ONLY = arg('only', '')

// Stands in for `BamSlightlyLazyFeature`: `next_ref` is the string the display
// used to read per read, `nextRefId` the number it reads instead.
class MateFeature {
  r: BamRecord
  names: string[]
  constructor(r: BamRecord, names: string[]) {
    this.r = r
    this.names = names
  }
  get(field: string) {
    return field === 'next_ref' ? this.nameOf(this.r.next_refid) : undefined
  }
  nameOf(id: number) {
    return id >= 0 ? (this.names[id] ?? `ref${id}`) : ''
  }
  get nextRefId() {
    return this.r.next_refid
  }
}

const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  const v = fn()
  const t = performance.now() - t0
  if ((v as { length?: number }).length === -1) {
    throw new Error('unreachable')
  }
  return t
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  const files = [
    { file: '1000x.shortread.bam', ref: 'chr22_mask', s: 124000, e: 143000 },
    { file: '200x.shortread.bam', ref: 'chr22_mask', s: 124000, e: 143000 },
    { file: '200x.longread.bam', ref: 'chr22_mask', s: 124000, e: 143000 },
  ].filter(f => f.file.includes(ONLY))

  for (const { file, ref, s, e } of files) {
    const path = join(DATA, file)
    try {
      readFileSync(path, { flag: 'r' })
    } catch {
      console.log(`${file}: absent, skipped`)
      continue
    }
    const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
    const header = await bam.getHeader()
    const names = (
      bam as unknown as { indexToChr?: { refName: string }[] }
    ).indexToChr!.map(c => c.refName)
    void header
    const records = await bam.getRecordsForRange(ref, s, e)
    if (!records.length) {
      continue
    }
    const feats = records.map(r => new MateFeature(r, names)) as never[]

    const buildStr = () => {
      const out: string[] = []
      for (const r of records) {
        out.push(r.next_refid >= 0 ? (names[r.next_refid] ?? '') : '')
      }
      return out
    }
    const buildStrControl = () => {
      const out: string[] = []
      for (const r of records) {
        out.push(r.next_refid >= 0 ? (names[r.next_refid] ?? '') : '')
      }
      return out
    }
    const buildSA = () => {
      const out: string[] = []
      for (const r of records) {
        out.push((r.getTag('SA') as string | undefined) ?? '')
      }
      return out
    }

    const strs = buildStr()
    const sa = buildSA()
    const table = buildReadNextRefs(feats)
    // The arm is CHECKED, because a stand-in that stops matching the interface
    // makes `buildReadNextRefs` take its fallback and report a fiction.
    if (table.readNextRefIds.length !== records.length) {
      throw new Error('buildReadNextRefs returned the wrong length')
    }
    for (let i = 0; i < records.length; i++) {
      const slot = table.readNextRefIds[i]!
      const got = slot < 0 ? '' : table.nextRefNames[slot]!
      if (got !== strs[i]) {
        throw new Error(`slot ${i}: ${got} !== ${strs[i]}`)
      }
    }

    const best: Record<string, number> = {}
    const run = (k: string, fn: () => unknown) => {
      best[k] = Math.min(best[k] ?? Infinity, time(fn))
    }
    for (let round = 0; round < ROUNDS; round++) {
      run('nrStr', buildStr)
      run('nrPostStr', () => structuredClone(strs))
      run('nrProd', () => buildReadNextRefs(feats))
      run('nrPostTable', () => {
        const ids = table.readNextRefIds.slice()
        return structuredClone(
          { ids, names: table.nextRefNames },
          { transfer: [ids.buffer] },
        )
      })
      run('saBuild', buildSA)
      run('saPost', () => structuredClone(sa))
      run('ctl', buildStrControl)
    }

    const f = (k: string) => best[k]!.toFixed(2).padStart(8)
    const shipped = best.nrStr! + best.nrPostStr!
    const now = best.nrProd! + best.nrPostTable!
    console.log(
      `${file}  ${records.length} reads, ` +
        `${new Set(strs).size} distinct mate refNames, ` +
        `SA on ${sa.filter(Boolean).length} reads\n` +
        `  readNextRefs  build string[] ${f('nrStr')} ms   post ${f('nrPostStr')} ms\n` +
        `  readNextRefs  build PROD     ${f('nrProd')} ms   post ${f('nrPostTable')} ms\n` +
        `  --------------------------------\n` +
        `  total  shipped               ${shipped.toFixed(2).padStart(8)} ms\n` +
        `  total  table                 ${now.toFixed(2).padStart(8)} ms   ${(shipped / now).toFixed(1)}x\n` +
        `  --------------------------------\n` +
        `  readSuppAlignments  build    ${f('saBuild')} ms   post ${f('saPost')} ms   ` +
        `total ${(best.saBuild! + best.saPost!).toFixed(2)} ms  <- not built at all with connections off\n` +
        `  control                      ${f('ctl')} ms   ${(best.nrStr! / best.ctl!).toFixed(3)}x  <- noise floor\n`,
    )
  }
}

await main()
