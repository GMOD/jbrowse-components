// Two per-read costs the alignments worker pays that @gmod/bam could answer more
// cheaply, sized against the walk the pileup actually renders from.
//
//   node --expose-gc plugins/alignments/benches/tagAndSeq.probe.ts --only=1000x
//
// Flags: --rounds=<n> (default 30), --data=<dir>, --only=<fixture substring>
//
// **RUN IT ONE FIXTURE AT A TIME.** Looping several fixtures through the same
// arm function objects contaminates every fixture after the first: it reported
// `fused` at 0.73x where one-process-per-fixture gives 1.22x, and the reversal
// followed POSITION rather than data — the two short-read fixtures here are
// byte-identical in tag layout and in memory layout. Pre-warming every arm on
// every fixture, releasing the other fixtures' records, and raising the rounds
// tenfold each fail to fix it; a separate process fixes it. That is now its own
// entry in agent-docs/reference/BENCHMARKING.md, and it is the reason this file
// grew an `--only` flag.
//
// A PROBE, not an A/B of two implementations — it sizes work the consumer does
// today against a candidate that does not exist yet, so read it for magnitudes
// and not for a speedup claim. The harness rules still apply and are in
// agent-docs/reference/BENCHMARKING.md: interleaved, min-of-rounds, and a
// control arm that is a second copy of one of the real ones.
//
// WHAT IT SAID, one fixture per process, min of 25 rotated rounds, controls
// 0.99-1.02x. The verdict and the five eliminated explanations for the
// size-dependence are in BAM_STACK_INTEGRATION.md's seam 4 — short version, the
// cost is real and the fused walk is NOT a justified fix:
//
//   1000x.shortread  both 35.3ms, fused 23.2ms (1.52x), mismatch walk 35.2ms
//   200x.shortread   both  8.0ms, fused  8.2ms (0.98x), mismatch walk  7.6ms
//
// PART 1 — TAG WALKS PER READ. `extractFeatureArrays` reads two tags on every
// read of every render, unconditionally:
//
//   getTag(feature, 'SA')            -> suppAlignments[]
//   getTagAlt(feature, 'MM', 'Mm')   -> extractModifications
//
// `BamRecord._findTag` walks the record's tag block until it matches, so a tag
// the read does not carry costs a FULL walk of every tag on it. On a plain
// short-read BAM (no SA, no MM) that is two whole walks per read to prove two
// absences. `getTagAlt` exists precisely because that pair of walks measured
// 12.9% of a 1000x short-read query in @gmod/bam — the SA lookup is the same
// shape and was never folded in. `fused` is what a 3-name single-pass accessor
// would cost.
//
// PART 2 — THE SEQUENCE, DECODED TWICE. On the modification color modes the
// worker asks each read for `seq` from two places in one render pass:
// `extractModifications` (for getModPositions) and `computeReadBaseCounts` (for
// the per-strand base pileup). `BamRecord.seq` is not memoized — deliberately,
// since records live in a shared chunk LRU and a 50kb string per read is
// exactly what should not be pinned there — so the second ask decodes the whole
// read again.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

import type { BamRecord } from '@gmod/bam'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const ROUNDS = Number(arg('rounds', '30'))
const DATA = arg('data', join(process.env.HOME!, 'src/jb2bench/data'))
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '143000'))
// Run a single fixture, by substring of its filename. **Required to get a real
// number** — see the header. Without it every fixture after the first is
// contaminated.
const ONLY = arg('only', '')
const pick = (files: string[]) => files.filter(f => f.includes(ONLY))

const time = (fn: () => unknown) => {
  globalThis.gc?.()
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

// ---------------------------------------------------------------------------
// Arms, written out longhand. Do not fold these into one parameterized driver —
// a shared call site goes polymorphic and hands every arm the same inline
// caches, which has scored a byte-identical control at 1.14x in this repo.

// what ships: two independent walks of the tag block
function armTwoWalksA(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    const sa = r.getTag('SA')
    const mm = r.getTagAlt('MM', 'Mm')
    if (sa !== undefined) {
      sink++
    }
    if (mm !== undefined) {
      sink++
    }
  }
  return sink
}

// the control: a second copy of the same thing
function armTwoWalksB(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    const sa = r.getTag('SA')
    const mm = r.getTagAlt('MM', 'Mm')
    if (sa !== undefined) {
      sink++
    }
    if (mm !== undefined) {
      sink++
    }
  }
  return sink
}

// SA alone, so the two halves of the pair can be sized separately
function armSaOnly(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    if (r.getTag('SA') !== undefined) {
      sink++
    }
  }
  return sink
}

// MM/Mm alone
function armMmOnly(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    if (r.getTagAlt('MM', 'Mm') !== undefined) {
      sink++
    }
  }
  return sink
}

// What a 3-name single-pass accessor would cost. Reimplemented here over the
// record's own bytes rather than added to @gmod/bam, because the point of the
// probe is to decide whether adding it is worth doing. Same walk shape as
// `_findTag`, matching three names instead of one.
function armFused(records: BamRecord[]) {
  let sink = 0
  const SA0 = 83
  const SA1 = 65
  const MM0 = 77
  const MM1 = 77
  const MML0 = 77
  const MML1 = 109
  for (const r of records) {
    const ba = r.byteArray
    // the same fields _findTag walks; read through the public surface so the
    // probe cannot accidentally measure a private fast path
    const rec = r as unknown as {
      tagsStart: number
      _end: number
      _dataView: DataView
    }
    let p = rec.tagsStart
    const blockEnd = rec._end
    const dv = rec._dataView
    let sa: unknown
    let mm: unknown
    while (p < blockEnd) {
      const c0 = ba[p]!
      const c1 = ba[p + 1]!
      const type = ba[p + 2]!
      const valueStart = p + 3
      let end: number
      if (type === 0x41 || type === 0x63 || type === 0x43) {
        end = valueStart + 1
      } else if (type === 0x73 || type === 0x53) {
        end = valueStart + 2
      } else if (type === 0x69 || type === 0x49 || type === 0x66) {
        end = valueStart + 4
      } else if (type === 0x5a || type === 0x48) {
        let q = valueStart
        while (q < blockEnd && ba[q] !== 0) {
          q++
        }
        end = q + 1
      } else if (type === 0x42) {
        const bt = ba[valueStart]!
        const limit = dv.getInt32(valueStart + 1, true)
        const w =
          bt === 0x69 || bt === 0x49 || bt === 0x66
            ? 4
            : bt === 0x73 || bt === 0x53
              ? 2
              : 1
        end = valueStart + 5 + limit * w
      } else {
        break
      }
      if (c0 === SA0 && c1 === SA1) {
        sa = 1
      } else if ((c0 === MM0 && c1 === MM1) || (c0 === MML0 && c1 === MML1)) {
        mm = 1
      }
      p = end
    }
    if (sa !== undefined) {
      sink++
    }
    if (mm !== undefined) {
      sink++
    }
  }
  return sink
}

// The walk the pileup actually renders from, for scale. If proving two tag
// absences costs a meaningful fraction of THIS, it is worth folding.
function armMismatchWalk(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    r.forEachMismatch((type, start) => {
      sink += type + start
    })
  }
  return sink
}

// ---------------------------------------------------------------------------
// Part 2 arms

function armSeqOnce(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    sink += r.seq.length
  }
  return sink
}

function armSeqTwice(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    sink += r.seq.length
    sink += r.seq.length
  }
  return sink
}

function armSeqOnceControl(records: BamRecord[]) {
  let sink = 0
  for (const r of records) {
    sink += r.seq.length
  }
  return sink
}

// ---------------------------------------------------------------------------

async function load(file: string) {
  const path = join(DATA, file)
  try {
    readFileSync(path, { flag: 'r' })
  } catch {
    return undefined
  }
  const bam = new BamFile({ bamPath: path, baiPath: `${path}.bai` })
  await bam.getHeader()
  const records = await bam.getRecordsForRange(REFNAME, START, END)
  return records.length ? records : undefined
}

function runSides<T extends string>(
  sides: { k: T; run: () => unknown }[],
  rounds: number,
) {
  const best = {} as Record<T, number>
  for (const s of sides) {
    best[s.k] = Infinity
  }
  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.k] = Math.min(best[side.k], time(side.run))
    }
  }
  return best
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc\n')
  }
  console.log(
    `per-read tag walks and sequence decodes\n${REFNAME}:${START}-${END}, min of ${ROUNDS} rotated rounds\n`,
  )

  console.log('PART 1 — tag walks (ms per query, all reads)\n')
  for (const file of pick([
    '1000x.shortread.bam',
    '200x.shortread.bam',
    '200x.longread.bam',
    '200x.longread.mod.bam',
  ])) {
    const records = await load(file)
    if (!records) {
      console.log(`  ${file}: absent or empty, skipped`)
      continue
    }
    // warm every arm identically, or the unwarmed ones enter the loop
    // monomorphic and win by an amount that is entirely the harness
    armTwoWalksA(records)
    armTwoWalksB(records)
    armSaOnly(records)
    armMmOnly(records)
    armFused(records)
    armMismatchWalk(records)

    const nSA = records.filter(r => r.getTag('SA') !== undefined).length
    const nMM = records.filter(
      r => r.getTagAlt('MM', 'Mm') !== undefined,
    ).length
    const best = runSides(
      [
        { k: 'two' as const, run: () => armTwoWalksA(records) },
        { k: 'sa' as const, run: () => armSaOnly(records) },
        { k: 'mm' as const, run: () => armMmOnly(records) },
        { k: 'fused' as const, run: () => armFused(records) },
        { k: 'walk' as const, run: () => armMismatchWalk(records) },
        { k: 'ctl' as const, run: () => armTwoWalksB(records) },
      ],
      ROUNDS,
    )
    const pct = (v: number) => `${((v / best.walk) * 100).toFixed(1)}%`
    console.log(
      `  ${file}  ${records.length} reads, ${nSA} carry SA, ${nMM} carry MM\n` +
        `    SA lookup        ${best.sa.toFixed(2).padStart(7)} ms  ${pct(best.sa).padStart(6)} of the mismatch walk\n` +
        `    MM/Mm lookup     ${best.mm.toFixed(2).padStart(7)} ms  ${pct(best.mm).padStart(6)}\n` +
        `    both (ships)     ${best.two.toFixed(2).padStart(7)} ms  ${pct(best.two).padStart(6)}\n` +
        `    fused one pass   ${best.fused.toFixed(2).padStart(7)} ms  ${pct(best.fused).padStart(6)}   ${(best.two / best.fused).toFixed(2)}x vs both\n` +
        `    control          ${best.ctl.toFixed(2).padStart(7)} ms  ${(best.two / best.ctl).toFixed(3)}x vs both  <- noise floor\n` +
        `    mismatch walk    ${best.walk.toFixed(2).padStart(7)} ms  (scale)\n`,
    )
  }

  console.log('\nPART 2 — sequence decode (ms per query, all reads)\n')
  for (const file of pick(['200x.longread.mod.bam', '1000x.shortread.bam'])) {
    const records = await load(file)
    if (!records) {
      console.log(`  ${file}: absent or empty, skipped`)
      continue
    }
    armSeqOnce(records)
    armSeqTwice(records)
    armSeqOnceControl(records)
    armMismatchWalk(records)
    const best = runSides(
      [
        { k: 'once' as const, run: () => armSeqOnce(records) },
        { k: 'twice' as const, run: () => armSeqTwice(records) },
        { k: 'walk' as const, run: () => armMismatchWalk(records) },
        { k: 'ctl' as const, run: () => armSeqOnceControl(records) },
      ],
      ROUNDS,
    )
    const bp = records.reduce((a, r) => a + r.seq_length, 0)
    console.log(
      `  ${file}  ${records.length} reads, ${(bp / 1e6).toFixed(1)} Mbp\n` +
        `    seq once         ${best.once.toFixed(2).padStart(7)} ms\n` +
        `    seq twice        ${best.twice.toFixed(2).padStart(7)} ms   (+${(best.twice - best.once).toFixed(2)} ms, what the second ask costs)\n` +
        `    control (once)   ${best.ctl.toFixed(2).padStart(7)} ms   ${(best.once / best.ctl).toFixed(3)}x  <- noise floor\n` +
        `    mismatch walk    ${best.walk.toFixed(2).padStart(7)} ms  (scale)\n`,
    )
  }
}

await main()
