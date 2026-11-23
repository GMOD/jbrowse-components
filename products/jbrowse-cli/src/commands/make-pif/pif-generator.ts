import { spawn } from 'node:child_process'
import { closeSync, createReadStream, openSync } from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import {
  coarsenCigar,
  csToCigar,
  flipCigar,
  flipCoarseCigar,
  swapCoarseCigar,
  swapIndelCigar,
} from '@jbrowse/cigar-utils'

import {
  cLocaleEnv,
  describeExit,
  spawnTabSort,
  waitForProcessClose,
} from '../process-utils.ts'

import type { Writable } from 'node:stream'

// Default gap (bp) of the coarse tier's coarse CIGAR: how far a straight line
// across one of its runs may be from the alignment's real path. Indels longer
// than half of it keep their letter; shorter ones fold into the runs. 10kb
// matches the adapter's default coarseBpPerPxThreshold, so at the zoom where the
// tier is served the bound is ~1px and a folded indel was sub-pixel anyway.
export const DEFAULT_COARSE_GAP = 10_000

// What one pass over the PAF observed, for the caller's summary and warnings.
// `samples` collects the PanSN sample prefixes (`sample#…` → `sample`) seen: a
// non-empty set means the input is all-vs-all rather than pairwise, and the
// samples are the assembly names to suggest in the add-track command. `skipped`
// counts rows that were not valid PAF, which would otherwise leave an empty file
// and a success message.
export interface PifStats {
  samples: Set<string>
  // Which pairs of DISTINCT samples the file actually states, order-independent.
  // An "all-vs-all" PAF often is not one — wfmash with a -p threshold drops
  // distant pairs, and a star-topology mapping states only the reference's
  // pairs — and the resulting track draws an empty synteny band for every pair
  // the aligner never emitted, which is indistinguishable from a locus with no
  // homology. Collected on the pass already being made so the command can say so
  // at the moment the file is built, which is the only moment anyone is looking.
  pairs: Set<string>
  rows: number
  // rows that carried an alignment string (cg or cs), which the header reports
  // so a reader knows whether a coarse row without a fold is a bounded single
  // run or an alignment nothing could fold
  cigarRows: number
  skipped: number
}

// Generation 2 (2026-09) writes `pi:i:`, the input row's index, on every row.
// golden.test.ts pins the bytes one generation writes; ADR-235 states the bump
// rule.
export const PIF_FORMAT_VERSION = 2

/**
 * The one meta line a PIF carries, sorted first by the C-locale sort and kept
 * by tabix as a header. It states the format generation, the tiers
 * written, the coarse tier's accuracy bound (`--coarse`), and whether every
 * input row had a CIGAR — the facts a reader cannot recover from the rows. It
 * states no writer or CLI release, so a PIF's bytes change with its generation
 * alone (ADR-235).
 */
export function pifHeader(coarseGap: number | undefined, stats: PifStats) {
  const cigars =
    stats.cigarRows === 0
      ? 'none'
      : stats.cigarRows === stats.rows
        ? 'all'
        : 'some'
  const tiers = coarseGap === undefined ? 'fine' : 'fine,coarse'
  const bound = coarseGap === undefined ? '' : `\tcoarse:i:${coarseGap}`
  return `#pif\tversion:i:${PIF_FORMAT_VERSION}\ttiers:Z:${tiers}${bound}\tcigars:Z:${cigars}\n`
}

function panSNSample(refName: string) {
  const i = refName.indexOf('#')
  return i === -1 ? undefined : refName.slice(0, i)
}

function addPanSNPair(stats: PifStats, c1: string, c2: string) {
  const a = panSNSample(c1)
  const b = panSNSample(c2)
  if (a !== undefined) {
    stats.samples.add(a)
  }
  if (b !== undefined) {
    stats.samples.add(b)
  }
  if (a !== undefined && b !== undefined && a !== b) {
    stats.pairs.add(a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`)
  }
}

/**
 * The sample pairs a complete all-vs-all would state but this file does not.
 * Empty for a pairwise PAF (no PanSN names) and for a genuinely complete file.
 */
export function missingPairs({ samples, pairs }: PifStats) {
  const sorted = [...samples].sort()
  const out: [string, string][] = []
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i]!
      const b = sorted[j]!
      if (!pairs.has(`${a}\u0000${b}`)) {
        out.push([a, b])
      }
    }
  }
  return out
}

// The coarse row's `cr:Z:` value, or nothing when the row has no CIGAR or the
// fold is a single run that closes on the coordinate columns, which then say it
// all. A fold of several runs with no kept indel is still written: a lopsided
// cluster of small indels bends the path by their sum. So is a fold whose walk
// misses the row's own far corner (clipping ops, a hand-made cg, a cs whose
// spans don't add up): the fine tier walks that CIGAR from the start corner
// without checking, and the coarse tier draws the same path only if it walks
// the same fold.
function coarseFold({
  cigar,
  coarseGap,
  ownLen,
  mateLen,
}: {
  cigar: string | undefined
  coarseGap: number
  ownLen: number
  mateLen: number
}) {
  if (cigar === undefined) {
    return undefined
  }
  const coarse = coarsenCigar(cigar, coarseGap)
  const closed = coarse.ownLen === ownLen && coarse.mateLen === mateLen
  return !closed || coarse.gapCount > 0 || coarse.opCount > 1
    ? coarse.ops
    : undefined
}

// A PIF row carries exactly ONE alignment string — `cg:Z:`, in the orientation
// of the perspective it is indexed under. A minimap2 `cs:Z:` is folded into that
// CIGAR and never emitted, for two reasons:
//
//  - `cs` has its own orientation, and reorienting it means reversing op order
//    AND reverse-complementing the spelled-out bases. Keeping an unflipped `cs`
//    beside a flipped `cg` is silently wrong rather than merely lossy:
//    `SyntenyFeature.forEachMismatch` prefers `cs`, so a row from
//    `minimap2 -c --cs` (which emits both tags) drew every indel with reversed
//    sense from the query perspective.
//  - `csToCigar` yields `=`/`X`, so folding a `cs` in is strictly MORE
//    informative than minimap2's own M-style `cg` — which is why `cs` wins when
//    a row carries both. The substituted base letters are the only thing lost;
//    mismatch positions survive as `X`.
//
// Returns the rewritten optional-tag list and where the surviving alignment
// string sits in it (-1 when the row carries none).
function foldCsIntoCg(tags: string[]) {
  const csIdx = tags.findIndex(f => f.startsWith('cs:Z'))
  if (csIdx === -1) {
    return { tags, cigarIdx: tags.findIndex(f => f.startsWith('cg:Z')) }
  }
  const folded = `cg:Z:${csToCigar(tags[csIdx]!.slice(5))}`
  const rewritten = tags.flatMap((f, i) =>
    i === csIdx ? [folded] : f.startsWith('cg:Z') ? [] : [f],
  )
  return { tags: rewritten, cigarIdx: rewritten.indexOf(folded) }
}

function pifRow(fields: (string | number | undefined)[]) {
  return `${fields.join('\t')}\n`
}

function processLine(
  rawLine: string,
  coarseGap: number | undefined,
  stats: PifStats,
): string {
  const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
  if (line.startsWith('#')) {
    return ''
  }
  const parts = line.split('\t')
  // A valid PAF row has 12 mandatory columns; anything shorter (blank, or
  // truncated) would produce NaN coords, so skip it rather than emit garbage.
  if (parts.length < 12) {
    stats.skipped++
    return ''
  }
  stats.rows++
  // rest[0]=num_matches, rest[1]=block_len, rest[2]=mapq, rest[3+]=optional tags
  const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = parts
  addPanSNPair(stats, c1!, c2!)

  // an incoming cr:Z: or pi:i: (a PIF turned back into PAF, or a tool that
  // adopted the tags) is dropped: the coarse tier writes its own fold below,
  // and every row of this alignment gets this pass's row index as `pi`, the
  // one id its four rows share across perspectives and tiers
  const { tags, cigarIdx } = foldCsIntoCg([
    ...rest.filter(f => !f.startsWith('cr:') && !f.startsWith('pi:')),
    `pi:i:${stats.rows - 1}`,
  ])
  const cigar = cigarIdx === -1 ? undefined : tags[cigarIdx]!.slice(5)
  if (cigar !== undefined) {
    stats.cigarRows++
  }

  // the t-row keeps the CIGAR as PAF spelled it (target perspective); the q-row
  // re-orients it for the query perspective it is indexed under
  const queryTags =
    cigar === undefined
      ? tags
      : tags.map((f, i) =>
          i === cigarIdx
            ? `cg:Z:${strand === '-' ? flipCigar(cigar) : swapIndelCigar(cigar)}`
            : f,
        )

  const fineRows =
    pifRow([`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...tags]) +
    pifRow([`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...queryTags])

  if (coarseGap === undefined) {
    return fineRows
  }

  // the coarse row is the fine row with its CIGAR replaced by the fold and
  // every other column and tag verbatim, so a click and the identity coloring
  // read the same on both tiers
  const coarse = cigarIdx === -1 ? tags : tags.filter((_, i) => i !== cigarIdx)
  // the T row's own axis is the target, as the PAF CIGAR is written; the Q row
  // re-orients it for the query, the way the fine tier's cg is
  const cr = coarseFold({
    cigar,
    coarseGap,
    ownLen: +e2! - +s2!,
    mateLen: +e1! - +s1!,
  })
  const tCr = cr === undefined ? [] : [`cr:Z:${cr}`]
  const qCr =
    cr === undefined
      ? []
      : [`cr:Z:${strand === '-' ? flipCoarseCigar(cr) : swapCoarseCigar(cr)}`]

  return (
    fineRows +
    pifRow([`T${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...coarse, ...tCr]) +
    pifRow([`Q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...coarse, ...qCr])
  )
}

function makePifTransform(
  coarseGap: number | undefined,
  stats: PifStats,
): Transform {
  let tail = ''
  return new Transform({
    transform(chunk: Buffer, _enc, callback) {
      const data = tail + chunk.toString('utf8')
      const lastNl = data.lastIndexOf('\n')
      if (lastNl === -1) {
        tail = data
        callback()
        return
      }
      tail = data.slice(lastNl + 1)
      callback(
        null,
        data
          .slice(0, lastNl)
          .split('\n')
          .filter(Boolean)
          .map(l => processLine(l, coarseGap, stats))
          .join(''),
      )
    },
    flush(callback) {
      // the header goes out last and sorts first: the counts it states are
      // only known once every row has been seen, and `#` precedes every tier
      // letter in the C locale
      callback(
        null,
        (tail ? processLine(tail, coarseGap, stats) : '') +
          pifHeader(coarseGap, stats),
      )
    },
  })
}

// resolves to what the pass observed: the PanSN samples (empty for a pairwise
// PAF), so the caller can suggest the right adapter and assembly names, and the
// row/skip counts so it can warn on a file that was not PAF at all
export async function createPIF(
  filename: string | undefined,
  stream: Writable,
  coarseGap?: number,
): Promise<PifStats> {
  const stats: PifStats = {
    samples: new Set(),
    pairs: new Set(),
    rows: 0,
    cigarRows: 0,
    skipped: 0,
  }
  const transform = makePifTransform(coarseGap, stats)
  if (filename) {
    const source = createReadStream(filename)
    await (/\.b?gz$/i.test(filename)
      ? pipeline(source, createGunzip(), transform, stream)
      : pipeline(source, transform, stream))
  } else {
    await pipeline(process.stdin, transform, stream)
  }
  return stats
}

// bgzip is the only stage of this pipeline that cannot use more than one core on
// its own: sort parallelizes itself and tabix is I/O bound. 4 is enough to take
// compression off the critical path on the files this command is pointed at
// without claiming a whole machine.
export const DEFAULT_BGZIP_THREADS = 4

// The stages are separate children, not one `sort | bgzip && tabix` shell
// pipeline, because a shell reports only the last stage of a pipeline: a sort
// that died (ENOSPC in TMPDIR) left bgzip a short input and a clean exit, and
// the truncated PIF was renamed into place. Each exit is checked here, and
// tabix runs only once sort and bgzip have both succeeded. `done` resolves to
// what went wrong, or nothing.
export function spawnPifIndexer(
  outputFile: string,
  useCsi: boolean,
  threads = DEFAULT_BGZIP_THREADS,
) {
  // -s: tabix wants the rows ordered by (refName, start) and by nothing else,
  // so the whole-line comparison a non-stable sort falls back to on a tie is
  // comparing multi-kb CIGARs to pick an order no reader can observe
  const sort = spawnTabSort(3, { stable: true })
  const outputFd = openSync(outputFile, 'w')
  const bgzip = spawn('bgzip', ['-@', `${threads}`], {
    env: cLocaleEnv(),
    stdio: [sort.stdout, outputFd, process.stderr],
  })
  closeSync(outputFd)
  sort.stdout.destroy()

  const done = async () => {
    const [sortExit, bgzipExit] = await Promise.all([
      waitForProcessClose(sort),
      waitForProcessClose(bgzip),
    ])
    const failedStage = [
      { name: 'sort', exit: sortExit },
      { name: 'bgzip', exit: bgzipExit },
    ].find(({ exit }) => exit.code !== 0)
    if (failedStage) {
      return `${failedStage.name} exited with ${describeExit(failedStage.exit)}`
    }
    const tabixExit = await waitForProcessClose(
      spawn(
        'tabix',
        [...(useCsi ? ['-C'] : []), '-s1', '-b3', '-e4', '-0', outputFile],
        {
          env: cLocaleEnv(),
          stdio: ['ignore', process.stdout, process.stderr],
        },
      ),
    )
    return tabixExit.code === 0
      ? undefined
      : `tabix exited with ${describeExit(tabixExit)}`
  }
  return { stdin: sort.stdin, done: done() }
}

export function getOutputFilename(
  file: string | undefined,
  out?: string,
): string {
  // strip .paf or .paf.gz so a gzipped input doesn't yield input.paf.gz.pif.gz
  const base = path.basename(file || 'output').replace(/\.paf(\.gz)?$/i, '')
  return out || `${base}.pif.gz`
}
