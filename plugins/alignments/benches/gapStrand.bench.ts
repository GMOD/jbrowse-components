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
// FIVE ARMS, one a control:
//   tags      — what ships[1]: get('tags'), i.e. the full decode
//   targeted  — what ships now: getTagAlt('XS','TS') + getTag('ts'); two walks
//               of the tag block, no value decoded but the one asked for
//   fused3    — one walk matching all three names. Does not exist as an API;
//               hand-rolled over the record's bytes to size it
//   fused3+MD — the same single walk, but JUMPING the MD value instead of
//               scanning to its null terminator. Also not an API
//   control   — a second, separately-declared copy of `tags`
//
// Written out longhand, five times, deliberately — a shared driver makes the
// call site polymorphic and hands every arm one set of inline caches.
//
// WHAT IT SAYS. The real corpus gives two far-apart points and no idea where
// between them the trade flips, so `jb2bench/make-mdsweep.py` synthesises the
// curve: 50,000 spliced reads per fixture, identical but for MD length, in two
// families. All one fixture per process, controls 0.96-1.03x.
//
// MD size is not the only variable — TAG ORDER is, and it is the one that is
// easy to miss. A walk looking for XS stops when it finds it, so a read carrying
// XS ahead of MD never scans MD at all.
//
//   tag B/read   tags    targeted    fused3   fused3+MD
//   -- XS present, ahead of MD: the walk short-circuits --
//         60     58.7      7.3 (8.0x)     -      10.4
//      1,550    167.1     12.2 (13.7x)    -      12.9
//      9,050    698.7     13.1 (53.3x)  509.6    14.7
//   -- no XS/TS/ts at all: the walk must cross MD --
//        446     86.6     45.2 (1.9x)   30.5      7.3 (11.9x)
//      1,546    137.3    129.2 (1.06x)  80.6     13.4 (10.3x)
//      9,046    647.6    770.4 (0.84x) 432.6     14.0 (46.2x)
//
// THE SHAPE, WHICH MATTERS MORE THAN ANY ROW: `get('tags')` is the only form
// whose cost scales with MD — 59ms to 699ms across the sweep. Both other forms
// are roughly FLAT in MD, for different reasons. `targeted` is flat when the tag
// it wants appears before MD, and degrades to worse-than-decode when nothing
// answers and it crosses MD twice. The MD skip is flat unconditionally, ~7-15ms
// everywhere, because it stops touching MD at all.
//
// So the shipped targeted form wins in seven of the eight cells, and the one
// loss (0.84x) needs BOTH a kilobyte-scale MD AND no strand tag on the read —
// long-read RNA aligned with --MD, from a library where orientation could not be
// inferred. Folding the two walks into one does not rescue it (1.50x at best);
// only not scanning MD does.
//
// And the metadata to skip it ALREADY EXISTS: `NUMERIC_MD` memoizes a
// `Uint8Array` **subarray view** of MD's bytes, so a record that has resolved it
// carries MD's start and length in O(1) (`md.byteOffset - byteArray.byteOffset`,
// `+ md.length + 1` for the terminator). On the alignments render path that memo
// is always populated before `getEffectiveStrand` runs, because
// `forEachMismatch` reads NUMERIC_MD to walk the read.
//
// WHY IT IS NOT DONE HERE. The cursor belongs to `@gmod/bam` — `_findTag`,
// `getTagAlt` and `_computeTags` share `tagValueEnd`, and a consumer cannot
// reach it. An implementation must also read `_cachedNUMERIC_MD` ONLY when it is
// already populated, never call the getter: triggering it costs exactly the walk
// being avoided. Filed as seam 5 in
// agent-docs/reference/BAM_STACK_INTEGRATION.md.
//
// [1] `get('tags')` was replaced by the targeted form in the commit that added
// this bench; it stays as the baseline every ratio is against.
//
// One caveat on the identity check: the `noxs` fixtures and `200x.longread`
// carry no XS/TS/ts, so every arm returns 0 there and agreement proves nothing.
// The `mdsweep.<n>.bam` family and the volvox spliced fixtures carry XS with
// both signs, and are where the arms are actually cross-checked.
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

// ---------------------------------------------------------------------------
// Two candidates that do not exist as APIs yet. Both walk the record's bytes
// directly, which a real implementation would not have to — inside BamRecord
// this is an argument-count change to the cursor `_findTag`/`getTagAlt`/
// `_computeTags` already share.

// ONE pass matching all three names. The two-walk shape is what loses to a
// single decode when MD is kilobytes, so the question is whether one walk beats
// the decode in BOTH regimes — if it does, the regime split disappears rather
// than being mitigated.
function armFused3(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    const rec = r as unknown as {
      byteArray: Uint8Array
      tagsStart: number
      _end: number
      _dataView: DataView
    }
    const ba = rec.byteArray
    const blockEnd = rec._end
    let p = rec.tagsStart
    let xs: number | undefined
    let ts: number | undefined
    while (p < blockEnd) {
      const c0 = ba[p]!
      const c1 = ba[p + 1]!
      const type = ba[p + 2]!
      const v = p + 3
      let end: number
      if (type === 0x41 || type === 0x63 || type === 0x43) {
        end = v + 1
      } else if (type === 0x73 || type === 0x53) {
        end = v + 2
      } else if (type === 0x69 || type === 0x49 || type === 0x66) {
        end = v + 4
      } else if (type === 0x5a || type === 0x48) {
        let q = v
        while (q < blockEnd && ba[q] !== 0) {
          q++
        }
        end = q + 1
      } else if (type === 0x42) {
        const bt = ba[v]!
        const limit = rec._dataView.getInt32(v + 1, true)
        const w =
          bt === 0x69 || bt === 0x49 || bt === 0x66
            ? 4
            : bt === 0x73 || bt === 0x53
              ? 2
              : 1
        end = v + 5 + limit * w
      } else {
        break
      }
      // XS / TS take the first that appears; ts is distinct (lowercase)
      if (type === 0x41) {
        if (
          xs === undefined &&
          ((c0 === 88 && c1 === 83) || (c0 === 84 && c1 === 83))
        ) {
          xs = ba[v]!
        } else if (c0 === 116 && c1 === 115) {
          ts = ba[v]!
        }
      }
      p = end
    }
    if (xs === 43) {
      sink += 1
    } else if (xs === 45) {
      sink -= 1
    } else {
      sink += ts === 43 ? 1 : ts === 45 ? -1 : 0
    }
  }
  return sink
}

// The same single pass, but jumping the MD value instead of scanning to its
// null terminator. `NUMERIC_MD` memoizes a SUBARRAY VIEW of those bytes, so a
// record that has resolved it already carries MD's start and length — the
// "small metadata" is free and already there. On the render path the memo is
// populated before this runs, since `forEachMismatch` reads NUMERIC_MD to walk
// the read. Pre-warmed outside the timed region below, for every arm equally.
function armFused3MdSkip(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    const rec = r as unknown as {
      byteArray: Uint8Array
      tagsStart: number
      _end: number
      _dataView: DataView
    }
    const ba = rec.byteArray
    const blockEnd = rec._end
    const md = r.NUMERIC_MD
    // where MD's value starts and where the next tag begins, in O(1)
    const mdStart = md ? md.byteOffset - ba.byteOffset : -1
    const mdNext = md ? mdStart + md.length + 1 : -1
    let p = rec.tagsStart
    let xs: number | undefined
    let ts: number | undefined
    while (p < blockEnd) {
      const c0 = ba[p]!
      const c1 = ba[p + 1]!
      const type = ba[p + 2]!
      const v = p + 3
      let end: number
      if (v === mdStart) {
        end = mdNext
      } else if (type === 0x41 || type === 0x63 || type === 0x43) {
        end = v + 1
      } else if (type === 0x73 || type === 0x53) {
        end = v + 2
      } else if (type === 0x69 || type === 0x49 || type === 0x66) {
        end = v + 4
      } else if (type === 0x5a || type === 0x48) {
        let q = v
        while (q < blockEnd && ba[q] !== 0) {
          q++
        }
        end = q + 1
      } else if (type === 0x42) {
        const bt = ba[v]!
        const limit = rec._dataView.getInt32(v + 1, true)
        const w =
          bt === 0x69 || bt === 0x49 || bt === 0x66
            ? 4
            : bt === 0x73 || bt === 0x53
              ? 2
              : 1
        end = v + 5 + limit * w
      } else {
        break
      }
      if (type === 0x41) {
        if (
          xs === undefined &&
          ((c0 === 88 && c1 === 83) || (c0 === 84 && c1 === 83))
        ) {
          xs = ba[v]!
        } else if (c0 === 116 && c1 === 115) {
          ts = ba[v]!
        }
      }
      p = end
    }
    if (xs === 43) {
      sink += 1
    } else if (xs === 45) {
      sink -= 1
    } else {
      sink += ts === 43 ? 1 : ts === 45 ? -1 : 0
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
    // The MD sweep: 50,000 spliced reads apiece, identical in every way except
    // how many bytes their MD tag holds. Built by jb2bench's `make-mdsweep.py`,
    // because the real corpus gives two far-apart points (~75 tag bytes on short
    // reads, ~9,000 on long) and no idea where between them the trade flips.
    { path: join(DATA, 'mdsweep.10.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.100.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.400.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.1500.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.4000.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.9000.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.10.noxs.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.100.noxs.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.400.noxs.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.1500.noxs.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.4000.noxs.bam'), repeat: 1 },
    { path: join(DATA, 'mdsweep.9000.noxs.bam'), repeat: 1 },
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
    const refs =
      path.includes('test_data') || path.includes('mdsweep')
        ? ['ctgA']
        : [REFNAME]
    let one: BamRecord[] = []
    for (const ref of refs) {
      const whole = path.includes('test_data') || path.includes('mdsweep')
      one = await bam.getRecordsForRange(
        ref,
        whole ? 0 : START,
        whole ? 300_000_000 : END,
      )
      if (one.length) {
        break
      }
    }
    if (!one.length) {
      continue
    }
    // Only the reads this function is ever called for — but ONLY for the
    // test_data fixtures, which are the ones that carry skips. The jb2bench
    // fixtures are regime probes rather than call sites: `200x.longread` has no
    // skips at all, so this function never runs on it, and it is here purely to
    // characterise what a kilobyte-scale MD does to the trade. Filtering it to
    // spliced reads would leave nothing to measure.
    const spliced = !path.includes('test_data')
      ? one
      : one.filter(r => {
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
    // NUMERIC_MD is memoized separately from tags and `reset` does not clear
    // it; warm it for every arm alike, outside any timing, because that is the
    // state the render path is in when getEffectiveStrand runs.
    for (const r of records) {
      void r.NUMERIC_MD
    }
    reset(records)
    const d = armFused3(records)
    reset(records)
    const e = armFused3MdSkip(records)
    if (a !== b || a !== c || a !== d || a !== e) {
      throw new Error(
        `arms disagree: tags=${a} targeted=${b} control=${c} fused3=${d} fused3md=${e}`,
      )
    }

    let tagBytes = 0
    let tagCount = 0
    for (const r of records) {
      const rec = r as unknown as { _end: number; tagsStart: number }
      tagBytes += rec._end - rec.tagsStart
      tagCount += Object.keys(r.tags).length
    }

    const best = {
      tags: Infinity,
      targeted: Infinity,
      fused3: Infinity,
      fused3md: Infinity,
      ctl: Infinity,
    }
    const sides = [
      { k: 'tags' as const, run: () => armTagsA(records) },
      { k: 'targeted' as const, run: () => armTargeted(records) },
      { k: 'fused3' as const, run: () => armFused3(records) },
      { k: 'fused3md' as const, run: () => armFused3MdSkip(records) },
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
        `  fused3 (1 pass)${best.fused3.toFixed(2).padStart(8)} ms   ` +
        `${(best.tags / best.fused3).toFixed(2)}x\n` +
        `  fused3+MD skip ${best.fused3md.toFixed(2).padStart(8)} ms   ` +
        `${(best.tags / best.fused3md).toFixed(2)}x\n` +
        `  control        ${best.ctl.toFixed(2).padStart(8)} ms   ` +
        `${(best.tags / best.ctl).toFixed(3)}x  <- noise floor\n`,
    )
  }
}

await main()
