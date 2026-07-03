import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import {
  flipCigar,
  splitCigarOnLargeGaps,
  swapIndelCigar,
} from './cigar-utils.ts'

import type { Writable } from 'node:stream'

// Default split gap (bp) for the coarse tier. A row is broken into multiple
// coarse pieces wherever a CIGAR insertion/deletion is at least this long, so
// each coarse row's bounding box stays tight. 10kb matches the adapter's
// default coarseBpPerPxThreshold (~1px at the zoom where the coarse tier is
// served), so smaller gaps that would be sub-pixel there don't fragment rows.
export const DEFAULT_COARSE_SPLIT_GAP = 10_000

function processLine(line: string, coarseSplitGap: number | undefined): string {
  const parts = line.split('\t')
  // A valid PAF row has 12 mandatory columns; anything shorter (blank, comment,
  // or truncated) would produce NaN coords, so skip it rather than emit garbage.
  if (parts.length < 12) {
    return ''
  }
  const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = parts
  // rest[0]=num_matches, rest[1]=block_len, rest[2]=mapq, rest[3+]=optional tags

  const tRow = `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t')}\n`

  const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z'))
  const CIGAR = rest[cigarIdx]
  const cigarStr = CIGAR ? CIGAR.slice(5) : undefined
  if (cigarStr) {
    rest[cigarIdx] = `cg:Z:${
      strand === '-' ? flipCigar(cigarStr) : swapIndelCigar(cigarStr)
    }`
  }
  const qRow = `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t')}\n`

  if (coarseSplitGap === undefined) {
    return tRow + qRow
  }

  // When no CIGAR is present, fall back to the PAF's own num_matches/block_len
  // so coarse-tier identity (de:f:) reflects the aligner's reported value rather
  // than defaulting to 100% divergence.
  const segments = cigarStr
    ? splitCigarOnLargeGaps({
        cigar: cigarStr,
        strand: strand!,
        tstart: +s2!,
        qstart: +s1!,
        qend: +e1!,
        splitGap: coarseSplitGap,
      })
    : [
        {
          tstart: +s2!,
          tend: +e2!,
          qstart: +s1!,
          qend: +e1!,
          numMatches: +rest[0]!,
          blockLen: +rest[1]!,
        },
      ]
  const mapq = rest[2]
  // With a CIGAR we recompute divergence per split segment. Without one, prefer
  // the aligner's own de:f: tag (more accurate than the num_matches/block_len
  // proxy) and only fall back to the computed value when no tag is present.
  const passthroughDe = cigarStr
    ? undefined
    : rest.find(f => f.startsWith('de:f:'))?.slice(5)
  let coarseRows = ''
  for (const seg of segments) {
    const de =
      passthroughDe ??
      (seg.blockLen > 0 ? (1 - seg.numMatches / seg.blockLen).toFixed(6) : '0')
    coarseRows += `${[
      `T${c2}`,
      l2,
      seg.tstart,
      seg.tend,
      strand,
      c1,
      l1,
      seg.qstart,
      seg.qend,
      seg.numMatches,
      seg.blockLen,
      mapq,
      `de:f:${de}`,
    ].join('\t')}\n`
    coarseRows += `${[
      `Q${c1}`,
      l1,
      seg.qstart,
      seg.qend,
      strand,
      c2,
      l2,
      seg.tstart,
      seg.tend,
      seg.numMatches,
      seg.blockLen,
      mapq,
      `de:f:${de}`,
    ].join('\t')}\n`
  }
  return tRow + qRow + coarseRows
}

function makePifTransform(coarseSplitGap?: number): Transform {
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
          .map(l => processLine(l, coarseSplitGap))
          .join(''),
      )
    },
    flush(callback) {
      callback(null, tail ? processLine(tail, coarseSplitGap) : '')
    },
  })
}

export async function createPIF(
  filename: string | undefined,
  stream: Writable,
  coarseSplitGap?: number,
): Promise<void> {
  const transform = makePifTransform(coarseSplitGap)
  if (filename) {
    const source = createReadStream(filename)
    await (/\.b?gz$/i.test(filename)
      ? pipeline(source, createGunzip(), transform, stream)
      : pipeline(source, transform, stream))
  } else {
    await pipeline(process.stdin, transform, stream)
  }
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
