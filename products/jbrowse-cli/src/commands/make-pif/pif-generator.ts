import { spawn } from 'child_process'
import { createReadStream } from 'fs'
import path from 'path'
import { Transform } from 'stream'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'

import { flipCigar, parseCigar, swapIndelCigar } from './cigar-utils.ts'
import { splitCigarOnLargeGaps } from './structural-summary.ts'

import type { Writable } from 'stream'

// Default split gap (bp) for the coarse tier. A row is broken into multiple
// coarse pieces wherever a CIGAR insertion/deletion is at least this long, so
// each coarse row's bounding box stays tight. 10kb matches the adapter's
// default coarseBpPerPxThreshold (~1px at the zoom where the coarse tier is
// served), so smaller gaps that would be sub-pixel there don't fragment rows.
export const DEFAULT_COARSE_SPLIT_GAP = 10_000

function processLine(
  line: string,
  emitCoarse: boolean,
  coarseSplitGap: number | undefined,
): string {
  const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')
  // rest[0]=num_matches, rest[1]=block_len, rest[2]=mapq, rest[3+]=optional tags

  const tRow = `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t')}\n`

  const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z'))
  const CIGAR = rest[cigarIdx]
  if (CIGAR) {
    rest[cigarIdx] = `cg:Z:${
      strand === '-'
        ? flipCigar(parseCigar(CIGAR.slice(5))).join('')
        : swapIndelCigar(CIGAR.slice(5))
    }`
  }
  const qRow = `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t')}\n`

  if (!emitCoarse) {
    return tRow + qRow
  }

  const segments = splitCigarOnLargeGaps({
    cigar: CIGAR ? CIGAR.slice(5) : undefined,
    strand: strand!,
    tstart: +s2!,
    tend: +e2!,
    qstart: +s1!,
    qend: +e1!,
    splitGap: coarseSplitGap,
  })
  const mapq = rest[2]
  let coarseRows = ''
  for (const seg of segments) {
    const de =
      seg.blockLen > 0 ? (1 - seg.numMatches / seg.blockLen).toFixed(6) : '0'
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
  const emitCoarse = coarseSplitGap !== undefined
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
          .map(l => processLine(l, emitCoarse, coarseSplitGap))
          .join(''),
      )
    },
    flush(callback) {
      callback(null, tail ? processLine(tail, emitCoarse, coarseSplitGap) : '')
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
    await (/.b?gz$/.exec(filename)
      ? pipeline(source, createGunzip(), transform, stream)
      : pipeline(source, transform, stream))
  } else {
    await pipeline(process.stdin, transform, stream)
  }
}

export function spawnSortProcess(outputFile: string, useCsi: boolean) {
  const sortCmd = `sort -t"\`printf '\\t'\`" -k1,1 -k3,3n`
  const bgzipCommand = `bgzip > "${outputFile}"`
  const tabixCommand = `tabix ${useCsi ? '-C ' : ''}-s1 -b3 -e4 -0 "${outputFile}"`
  const fullCommand = `${sortCmd} | ${bgzipCommand}; ${tabixCommand}`
  return spawn('sh', ['-c', fullCommand], {
    env: { ...process.env, LC_ALL: 'C' },
    stdio: ['pipe', process.stdout, process.stderr],
  })
}

export function getOutputFilename(
  file: string | undefined,
  out?: string,
): string {
  return out || `${path.basename(file || 'output', '.paf')}.pif.gz`
}
