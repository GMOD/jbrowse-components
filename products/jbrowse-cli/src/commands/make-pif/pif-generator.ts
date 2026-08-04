import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import {
  csToCigar,
  flipCigar,
  pafIdentity,
  swapIndelCigar,
} from '@jbrowse/cigar-utils'

import { splitCigarOnLargeGaps } from './cigar-utils.ts'

import type { Writable } from 'node:stream'

// Default split gap (bp) for the coarse tier. A row is broken into multiple
// coarse pieces wherever a CIGAR insertion/deletion is at least this long, so
// each coarse row's bounding box stays tight. 10kb matches the adapter's
// default coarseBpPerPxThreshold (~1px at the zoom where the coarse tier is
// served), so smaller gaps that would be sub-pixel there don't fragment rows.
export const DEFAULT_COARSE_SPLIT_GAP = 10_000

// What one pass over the PAF observed, for the caller's summary and warnings.
// `samples` collects the PanSN sample prefixes (`sample#…` → `sample`) seen: a
// non-empty set means the input is all-vs-all rather than pairwise, and the
// samples are the assembly names to suggest in the add-track command. `skipped`
// counts rows that were not valid PAF, which would otherwise leave an empty file
// and a success message.
export interface PifStats {
  samples: Set<string>
  rows: number
  skipped: number
}

function addPanSNSample(stats: PifStats, refName: string) {
  if (refName.includes('#')) {
    stats.samples.add(refName.slice(0, refName.indexOf('#')))
  }
}

// One piece of a row's coarse tier: its bounds plus the num_matches/block_len it
// reports. Multi-piece rows get the row's PAF totals apportioned by aligned
// length, so every piece implies the same identity as the row (and as the `de:f:`
// written beside it) and the pieces sum back to the row.
interface CoarsePiece {
  tstart: number
  tend: number
  qstart: number
  qend: number
  numMatches: number
  blockLen: number
}

function coarsePieces({
  cigar,
  strand,
  tstart,
  tend,
  qstart,
  qend,
  numMatches,
  blockLen,
  splitGap,
}: {
  cigar: string | undefined
  strand: string
  tstart: number
  tend: number
  qstart: number
  qend: number
  numMatches: number
  blockLen: number
  splitGap: number
}): CoarsePiece[] {
  const whole = { tstart, tend, qstart, qend, numMatches, blockLen }
  const segments =
    cigar && splitGap > 0
      ? splitCigarOnLargeGaps({ cigar, strand, tstart, qstart, qend, splitGap })
      : undefined
  // A row with nothing to split on keeps its PAF columns verbatim rather than
  // the CIGAR walk's reconstruction of them: identical for a well-formed cg, and
  // when they disagree (clipping ops, a CIGAR whose spans don't match the
  // coordinate columns) the columns are what the fine tier draws, so the coarse
  // row must not drift off them.
  return segments === undefined || segments.length < 2
    ? [whole]
    : segments.map(seg => ({
        ...seg,
        numMatches:
          blockLen > 0 ? Math.round((numMatches * seg.blockLen) / blockLen) : 0,
      }))
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

// Coarse identity must match the fine tier exactly, or coloring jumps at the
// zoom where the view switches tiers. So it is written off the SAME function the
// adapters read the fine tier with (de:f: tag, then odgi's id:f:, then
// num_matches/block_len) rather than a private copy of that chain — a copy is
// what previously skipped the id:f: rung. A CIGAR recompute is deliberately not
// in the chain at all: a cg (M-style) CIGAR folds mismatches into M, so it would
// report ~0 divergence (spurious 100% identity) for a divergent alignment.
//
// When the row's own de:f: is what the reader lands on, that string is passed
// through byte-for-byte rather than recomputed: a round trip through toFixed(6)
// would silently truncate a 7-decimal tag and drift the two tiers apart by the
// exact mechanism this is guarding against.
function coarseDivergence(
  tags: string[],
  numMatches: number,
  blockLen: number,
) {
  const rawDe = tags.find(f => f.startsWith('de:f:'))?.slice(5)
  const identity = pafIdentity({
    de: rawDe,
    id: tags.find(f => f.startsWith('id:f:'))?.slice(5),
    numMatches,
    blockLen,
  })
  return rawDe !== undefined && 1 - +rawDe === identity
    ? rawDe
    : (1 - identity).toFixed(6)
}

function pifRow(fields: (string | number | undefined)[]) {
  return `${fields.join('\t')}\n`
}

function processLine(
  line: string,
  coarseSplitGap: number | undefined,
  stats: PifStats,
): string {
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
  addPanSNSample(stats, c1!)
  addPanSNSample(stats, c2!)

  const { tags, cigarIdx } = foldCsIntoCg(rest)
  const cigar = cigarIdx === -1 ? undefined : tags[cigarIdx]!.slice(5)

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

  if (coarseSplitGap === undefined) {
    return fineRows
  }

  const numMatches = +tags[0]!
  const blockLen = +tags[1]!
  const mapq = tags[2]
  // Every optional tag except the alignment string itself rides along, so a
  // click on a coarse ribbon shows the same attributes as the same alignment
  // does zoomed in (rustybam's tags, minimap2's tp/cm/s1, odgi's id). Only the
  // CIGAR is dropped — dropping it is the entire point of the tier — and de:f:,
  // which is rewritten below. No `cs:Z:` can reach here: it was folded into the
  // cg above, since a PIF row carries one alignment string.
  const passthrough = tags
    .slice(3)
    .filter(f => !f.startsWith('cg:Z:') && !f.startsWith('de:f:'))
  const de = coarseDivergence(tags, numMatches, blockLen)

  return (
    fineRows +
    coarsePieces({
      cigar,
      strand: strand!,
      tstart: +s2!,
      tend: +e2!,
      qstart: +s1!,
      qend: +e1!,
      numMatches,
      blockLen,
      splitGap: coarseSplitGap,
    })
      .flatMap(piece => {
        const tail = [
          piece.numMatches,
          piece.blockLen,
          mapq,
          ...passthrough,
          `de:f:${de}`,
        ]
        const { tstart, tend, qstart, qend } = piece
        return [
          pifRow([
            `T${c2}`,
            l2,
            tstart,
            tend,
            strand,
            c1,
            l1,
            qstart,
            qend,
            ...tail,
          ]),
          pifRow([
            `Q${c1}`,
            l1,
            qstart,
            qend,
            strand,
            c2,
            l2,
            tstart,
            tend,
            ...tail,
          ]),
        ]
      })
      .join('')
  )
}

function makePifTransform(
  coarseSplitGap: number | undefined,
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
          .map(l => processLine(l, coarseSplitGap, stats))
          .join(''),
      )
    },
    flush(callback) {
      callback(null, tail ? processLine(tail, coarseSplitGap, stats) : '')
    },
  })
}

// resolves to what the pass observed: the PanSN samples (empty for a pairwise
// PAF), so the caller can suggest the right adapter and assembly names, and the
// row/skip counts so it can warn on a file that was not PAF at all
export async function createPIF(
  filename: string | undefined,
  stream: Writable,
  coarseSplitGap?: number,
): Promise<PifStats> {
  const stats: PifStats = { samples: new Set(), rows: 0, skipped: 0 }
  const transform = makePifTransform(coarseSplitGap, stats)
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

export function spawnSortProcess(outputFile: string, useCsi: boolean) {
  const sortCmd = `sort -t"\`printf '\\t'\`" -k1,1 -k3,3n`
  const bgzipCommand = `bgzip > "$1"`
  const tabixCommand = `tabix ${useCsi ? '-C ' : ''}-s1 -b3 -e4 -0 "$1"`
  // `&&` (not `;`) so a bgzip failure aborts before tabix runs and propagates
  // as the pipeline's exit code. The output path is passed as the shell's "$1"
  // positional rather than interpolated into the command string, so a path
  // with shell metacharacters (`"`, `$(...)`, backticks) can't break out and
  // execute — same technique as sort-utils.ts. useCsi is a fixed literal.
  const fullCommand = `${sortCmd} | ${bgzipCommand} && ${tabixCommand}`
  return spawn('sh', ['-c', fullCommand, 'sh', outputFile], {
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['pipe', process.stdout, process.stderr],
  })
}

export function getOutputFilename(
  file: string | undefined,
  out?: string,
): string {
  // strip .paf or .paf.gz so a gzipped input doesn't yield input.paf.gz.pif.gz
  const base = path.basename(file || 'output').replace(/\.paf(\.gz)?$/i, '')
  return out || `${base}.pif.gz`
}
