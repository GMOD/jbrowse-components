// What does `readIds: string[]` cost, built and then posted?
//
//   node --expose-gc plugins/alignments/benches/readIds.bench.ts --only=1000x
//
// Flags: --rounds=<n> (default 25), --data=<dir>, --only=<fixture substring>
//
// ONE FIXTURE PER PROCESS — agent-docs/reference/BENCHMARKING.md.
//
// THE QUESTION. `buildBaseFeatureData` puts `id: feature.id()` on every read,
// which for the alignments features is `` `${adapter.id}-${fileOffset}` `` — a
// template literal per read — and `buildBaseReadArrays` collects them into
// `readIds: string[]`, which is then structured-cloned to the main thread with
// the rest of the RPC result.
//
// Two reasons to suspect it. `dedupeById` used to build the same string per
// read and dropping it took the dedupe from 12.5% to 5.9% of worker busy time,
// so the construction is not free at depth. And REJECTED_IDEAS' feature-details
// entry measured structured clone as priced by object COUNT, not bytes — 153,677
// strings is 153,677 objects to clone, against one transferable for a typed
// array.
//
// So the cost has two halves and they need separating: a fix that removes the
// build but still posts 153k strings, or vice versa, buys only half.
//
// FOUR ARMS + a control, all over the same records:
//   build-str   — what ships: a template literal per read into a string[]
//   build-num   — a Float64Array of the raw fileOffset. Float64, not Uint32:
//                 a BAM virtual offset is (blockStart << 16) | inBlock, which
//                 passes 2^32 on any file over ~64 GB and is exact in a double
//                 to 2^53
//   post-str    — structuredClone of the string[] (what postMessage does)
//   post-num    — structuredClone of the Float64Array, transferred
//   control     — a second, separately-declared copy of build-str
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '25'))
const DATA = arg('data', join(process.env.HOME!, 'src/jb2bench/data'))
const ONLY = arg('only', '')

// stands in for `adapter.id`, which is a config hash of about this length
const ADAPTER_ID = 'J9v2mQ1xKp'

function buildStrA(records: BamRecord[]) {
  const out: string[] = []
  for (const r of records) {
    out.push(`${ADAPTER_ID}-${r.fileOffset}`)
  }
  return out
}

function buildStrControl(records: BamRecord[]) {
  const out: string[] = []
  for (const r of records) {
    out.push(`${ADAPTER_ID}-${r.fileOffset}`)
  }
  return out
}

function buildNum(records: BamRecord[]) {
  const out = new Float64Array(records.length)
  for (let i = 0; i < records.length; i++) {
    out[i] = records[i]!.fileOffset
  }
  return out
}

const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  const v = fn()
  const t = performance.now() - t0
  // keep the result alive past the clock so nothing is optimized out
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
    await bam.getHeader()
    const records = await bam.getRecordsForRange(ref, s, e)
    if (!records.length) {
      continue
    }

    // warm every arm identically
    const strs = buildStrA(records)
    buildStrControl(records)
    const nums = buildNum(records)
    structuredClone(strs)
    structuredClone(nums)

    const best = {
      bstr: Infinity,
      bnum: Infinity,
      pstr: Infinity,
      pnum: Infinity,
      ctl: Infinity,
    }
    const sides = [
      { k: 'bstr' as const, run: () => buildStrA(records) },
      { k: 'bnum' as const, run: () => buildNum(records) },
      { k: 'pstr' as const, run: () => structuredClone(strs) },
      {
        // transferred, which is what collectTransferables does for every typed
        // array in the result — so the clone is a pointer handoff, not a copy.
        // A fresh copy each round, since transferring detaches the source.
        k: 'pnum' as const,
        run: () => {
          const copy = nums.slice()
          return structuredClone(copy, { transfer: [copy.buffer] })
        },
      },
      { k: 'ctl' as const, run: () => buildStrControl(records) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const side = sides[(round + i) % sides.length]!
        best[side.k] = Math.min(best[side.k], time(side.run))
      }
    }
    const n = records.length
    console.log(
      `${file}  ${n} reads\n` +
        `  build string[]   ${best.bstr.toFixed(2).padStart(8)} ms\n` +
        `  build Float64    ${best.bnum.toFixed(2).padStart(8)} ms   ${(best.bstr / best.bnum).toFixed(1)}x\n` +
        `  post  string[]   ${best.pstr.toFixed(2).padStart(8)} ms\n` +
        `  post  Float64    ${best.pnum.toFixed(2).padStart(8)} ms   ${(best.pstr / best.pnum).toFixed(1)}x\n` +
        `  --------------------------------\n` +
        `  total  ships     ${(best.bstr + best.pstr).toFixed(2).padStart(8)} ms\n` +
        `  total  numeric   ${(best.bnum + best.pnum).toFixed(2).padStart(8)} ms   ` +
        `${((best.bstr + best.pstr) / (best.bnum + best.pnum)).toFixed(1)}x\n` +
        `  control          ${best.ctl.toFixed(2).padStart(8)} ms   ${(best.bstr / best.ctl).toFixed(3)}x  <- noise floor\n`,
    )
  }
}

await main()
