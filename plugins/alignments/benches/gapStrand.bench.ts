// What does reading three tags through `get('tags')` cost?
//
//   node --expose-gc plugins/alignments/benches/gapStrand.bench.ts --only=longread
//
// Flags: --rounds=<n> (default 30), --data=<dir>, --only=<fixture substring>
//
// **ONE FIXTURE PER PROCESS.** Looping fixtures through the same arm objects
// contaminates every one after the first — agent-docs/reference/BENCHMARKING.md,
// "Looping several DATASETS through the same arm function objects".
//
// THE QUESTION. `getEffectiveStrand` (features/gap/extract.ts) resolves the
// transcript strand a skip implies, and reads exactly three tags to do it:
//
//   const tags = feature.get('tags')
//   const xs = tags?.XS ?? tags?.TS
//   const ts = tags?.ts
//
// `get('tags')` is `BamRecord._computeTags`: a null-prototype object, plus
// EVERY tag value on the read decoded, whether or not anyone wanted it. On long
// reads that includes MD, which averages 9,135 bytes on `200x.longread` — so a
// spliced read pays a ~9 kB TextDecoder pass to answer a two-character
// question. It is also memoized onto the record, and records live in @gmod/bam's
// shared chunk LRU, so the object is then RETAINED for as long as the chunk is
// cached.
//
// It runs once per read carrying a skip (`makeCigarEmitter` memoizes it per
// read), which on RNA-seq is every spliced read — the case the function exists
// for.
//
// THREE ARMS, one a control:
//   tags      — what ships: get('tags'), i.e. the full decode
//   targeted  — getTagAlt('XS','TS') + getTag('ts'); two walks of the tag
//               block, no value decoded but the one asked for
//   control   — a second, separately-declared copy of `tags`
//
// Written out longhand, three times, deliberately — a shared driver makes the
// call site polymorphic and hands every arm one set of inline caches.
//
// Note the arms must run against FRESH records each round: `_computeTags`
// memoizes, so a second round over the same records measures a property read
// rather than a decode. `reset()` below drops the memo, and the control proves
// the reset itself is not what is being timed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile, BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '30'))
const DATA = arg('data', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
const ONLY = arg('only', '')

// Drop the memoized tags object so the next arm decodes rather than reads.
// Timed OUTSIDE the measured region, and identical for every arm.
function reset(records: BamRecord[]) {
  for (const r of records) {
    ;(r as unknown as { _cachedTags?: unknown })._cachedTags = undefined
  }
}

function armTagsA(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    const tags = r.tags as Record<string, string> | undefined
    const xs = tags?.XS ?? tags?.TS
    const ts = tags?.ts
    if (xs === '+') {
      sink += 1
    } else if (xs === '-') {
      sink -= 1
    } else {
      sink += ts === '+' ? 1 : ts === '-' ? -1 : 0
    }
  }
  return sink
}

function armTargeted(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    const xs = r.getTagAlt('XS', 'TS') as string | undefined
    if (xs === '+') {
      sink += 1
    } else if (xs === '-') {
      sink -= 1
    } else {
      const ts = r.getTag('ts') as string | undefined
      sink += ts === '+' ? 1 : ts === '-' ? -1 : 0
    }
  }
  return sink
}

function armControl(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    const tags = r.tags as Record<string, string> | undefined
    const xs = tags?.XS ?? tags?.TS
    const ts = tags?.ts
    if (xs === '+') {
      sink += 1
    } else if (xs === '-') {
      sink -= 1
    } else {
      sink += ts === '+' ? 1 : ts === '-' ? -1 : 0
    }
  }
  return sink
}

const time = (records: BamRecord[], fn: () => unknown) => {
  reset(records)
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  // The jb2bench fixtures bracket the tag-byte regimes; the test_data ones are
  // the only files in the repo that actually CARRY skips, i.e. the only ones
  // this function runs on at all. They are small, so they repeat to a working
  // set big enough to time.
  const files = [
    { path: join(DATA, '1000x.shortread.bam'), repeat: 1 },
    { path: join(DATA, '200x.longread.bam'), repeat: 1 },
    { path: 'test_data/volvox/spliced.bam', repeat: 40 },
    { path: 'test_data/volvox/volvox-rnasim.bam', repeat: 100 },
    { path: 'test_data/volvox/paired_end_stranded_rnaseq.bam', repeat: 100 },
  ].filter(f => f.path.includes(ONLY))
  console.log(
    `getEffectiveStrand: get('tags') vs targeted lookups\n` +
      `${REFNAME}:${START}-${END}, min of ${ROUNDS} rotated rounds\n`,
  )
  for (const { path, repeat } of files) {
    const file = path.split('/').pop()!
    try {
      readFileSync(path, { flag: 'r' })
    } catch {
      console.log(`  ${file}: absent, skipped\n`)
      continue
    }
    const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
    await bam.getHeader()
    const refs = path.includes('test_data') ? ['ctgA'] : [REFNAME]
    let one: BamRecord[] = []
    for (const ref of refs) {
      one = await bam.getRecordsForRange(
        ref,
        path.includes('test_data') ? 0 : START,
        path.includes('test_data') ? 300_000_000 : END,
      )
      if (one.length) {
        break
      }
    }
    if (!one.length) {
      continue
    }
    // Only the reads this function is ever called for.
    const spliced = one.filter(r => {
      const c = r.NUMERIC_CIGAR
      for (let i = 0; i < c.length; i++) {
        if ((c[i]! & 0xf) === 3) {
          return true
        }
      }
      return false
    })
    if (!spliced.length) {
      continue
    }
    // Replicate by CONSTRUCTING fresh records over the same bytes, never by
    // pushing the same object twice. `tags` memoizes onto the record, so a
    // repeated object serves 39 of every 40 reads from `_cachedTags` while the
    // targeted arm walks all 40 — which made this fixture read 0.82x for a
    // change that is 5.4x on a fixture with no repeats. The memo is per object,
    // so distinct objects over identical bytes is what a real query looks like.
    const records: BamRecord[] = []
    for (let i = 0; i < repeat; i++) {
      for (const r of spliced) {
        const src = r as unknown as {
          byteArray: Uint8Array
          _start: number
          _end: number
          _dataView: DataView
          fileOffset: number
        }
        records.push(
          new BamRecord(
            src.byteArray,
            src._start,
            src._end,
            src.fileOffset,
            src._dataView,
          ),
        )
      }
    }

    // warm every arm the same way, or the unwarmed ones enter the loop
    // monomorphic and win by an amount that is entirely the harness
    reset(records)
    const a = armTagsA(records)
    reset(records)
    const b = armTargeted(records)
    reset(records)
    const c = armControl(records)
    if (a !== b || a !== c) {
      throw new Error(`arms disagree: tags=${a} targeted=${b} control=${c}`)
    }

    let tagBytes = 0
    let tagCount = 0
    for (const r of records) {
      const rec = r as unknown as { _end: number; tagsStart: number }
      tagBytes += rec._end - rec.tagsStart
      tagCount += Object.keys(r.tags).length
    }

    const best = { tags: Infinity, targeted: Infinity, ctl: Infinity }
    const sides = [
      { k: 'tags' as const, run: () => armTagsA(records) },
      { k: 'targeted' as const, run: () => armTargeted(records) },
      { k: 'ctl' as const, run: () => armControl(records) },
    ]
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < sides.length; i++) {
        const s = sides[(round + i) % sides.length]!
        best[s.k] = Math.min(best[s.k], time(records, s.run))
      }
    }
    console.log(
      `${file}\n` +
        `  ${records.length} reads, ${(tagCount / records.length).toFixed(1)} tags/read, ` +
        `${(tagBytes / records.length).toFixed(0)} tag bytes/read\n` +
        `  tags (ships)   ${best.tags.toFixed(2).padStart(8)} ms\n` +
        `  targeted       ${best.targeted.toFixed(2).padStart(8)} ms   ` +
        `${(best.tags / best.targeted).toFixed(2)}x\n` +
        `  control        ${best.ctl.toFixed(2).padStart(8)} ms   ` +
        `${(best.tags / best.ctl).toFixed(3)}x  <- noise floor\n`,
    )
  }
}

await main()
