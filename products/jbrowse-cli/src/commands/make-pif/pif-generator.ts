import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'

import { csToCigar, flipCigar, swapIndelCigar } from '@jbrowse/cigar-utils'

import { splitCigarOnLargeGaps } from './cigar-utils.ts'

import type { Writable } from 'node:stream'

// Default split gap (bp) for the coarse tier. A row is broken into multiple
// coarse pieces wherever a CIGAR insertion/deletion is at least this long, so
// each coarse row's bounding box stays tight. 10kb matches the adapter's
// default coarseBpPerPxThreshold (~1px at the zoom where the coarse tier is
// served), so smaller gaps that would be sub-pixel there don't fragment rows.
export const DEFAULT_COARSE_SPLIT_GAP = 10_000

// collects the PanSN sample prefixes (`sample#…` → `sample`) seen across the
// PAF; a non-empty set means the input is all-vs-all rather than pairwise, and
// the samples are the assembly names to suggest in the add-track command
interface PanSNDetector {
  samples: Set<string>
}

function addPanSNSample(detect: PanSNDetector, refName: string) {
  if (refName.includes('#')) {
    detect.samples.add(refName.slice(0, refName.indexOf('#')))
  }
}

function processLine(
  line: string,
  coarseSplitGap: number | undefined,
  detect?: PanSNDetector,
): string {
  const parts = line.split('\t')
  // A valid PAF row has 12 mandatory columns; anything shorter (blank, comment,
  // or truncated) would produce NaN coords, so skip it rather than emit garbage.
  if (parts.length < 12) {
    return ''
  }
  const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = parts
  if (detect) {
    addPanSNSample(detect, c1!)
    addPanSNSample(detect, c2!)
  }
  // rest[0]=num_matches, rest[1]=block_len, rest[2]=mapq, rest[3+]=optional tags

  // Prefer an existing CIGAR (cg:Z). When only a minimap2 cs difference string
  // is present, rewrite it in place as a cg:Z tag so both PIF perspectives carry
  // a uniform CIGAR and the flip/split logic below works unchanged.
  let cigarIdx = rest.findIndex(f => f.startsWith('cg:Z'))
  if (cigarIdx === -1) {
    const csIdx = rest.findIndex(f => f.startsWith('cs:Z'))
    if (csIdx !== -1) {
      rest[csIdx] = `cg:Z:${csToCigar(rest[csIdx]!.slice(5))}`
      cigarIdx = csIdx
    }
  }

  const tRow = `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t')}\n`

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

  const numMatches = +rest[0]!
  const blockLen = +rest[1]!
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
          numMatches,
          blockLen,
        },
      ]
  const mapq = rest[2]
  // Coarse identity must match the fine tier so coloring is continuous across the
  // LOD switch. The row's own de:f: tag (minimap2 gap-compressed divergence) wins
  // for every coarse piece; without one, derive divergence from the PAF's
  // num_matches/block_len columns — the SAME source pafIdentity uses for the fine
  // tier. A CIGAR recompute is deliberately NOT used as the fallback: a cg
  // (M-style) CIGAR folds mismatches into M, so it would report ~0 divergence
  // (spurious 100% identity) for a divergent alignment, disagreeing with fine.
  const pafDe = rest.find(f => f.startsWith('de:f:'))?.slice(5)
  const de =
    pafDe ?? (blockLen > 0 ? ((blockLen - numMatches) / blockLen).toFixed(6) : '0')
  let coarseRows = ''
  for (const seg of segments) {
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

function makePifTransform(
  coarseSplitGap: number | undefined,
  detect: PanSNDetector,
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
          .map(l => processLine(l, coarseSplitGap, detect))
          .join(''),
      )
    },
    flush(callback) {
      callback(null, tail ? processLine(tail, coarseSplitGap, detect) : '')
    },
  })
}

// resolves to the PanSN samples seen (empty for a pairwise PAF), so the caller
// can suggest the right adapter and assembly names
export async function createPIF(
  filename: string | undefined,
  stream: Writable,
  coarseSplitGap?: number,
): Promise<PanSNDetector> {
  const detect: PanSNDetector = { samples: new Set() }
  const transform = makePifTransform(coarseSplitGap, detect)
  if (filename) {
    const source = createReadStream(filename)
    await (/\.b?gz$/i.test(filename)
      ? pipeline(source, createGunzip(), transform, stream)
      : pipeline(source, transform, stream))
  } else {
    await pipeline(process.stdin, transform, stream)
  }
  return detect
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
