import { spawn } from 'child_process'
import path from 'path'

import {
  extractLargeIndels,
  flipCigar,
  parseCigar,
  splitAlignmentByCigar,
  swapIndelCigar,
} from './cigar-utils.ts'
import {
  createWriteWithBackpressure,
  getReadline,
  getStdReadline,
} from './file-utils.ts'
import { mergeIntoStructuralBlocks } from './structural-summary.ts'
import { computeSyriTypes } from './syri-classify.ts'

import type { WritableStream } from './file-utils.ts'
import type { AlignmentRecord } from './structural-summary.ts'

function stripDetailFromRest(rest: string[]) {
  return rest.filter(f => !f.startsWith('cg:Z:') && !f.startsWith('cs:Z:'))
}

// Swap cs tag from target-perspective to query-perspective:
// *XY → *YX (swap ref/query), +seq → -seq (ins→del), -seq → +seq (del→ins)
function flipCs(cs: string) {
  let result = ''
  let i = 0
  while (i < cs.length) {
    const ch = cs[i]!
    if (ch === ':') {
      const start = i
      i++
      while (i < cs.length && cs[i]! >= '0' && cs[i]! <= '9') {
        i++
      }
      result += cs.slice(start, i)
    } else if (ch === '*') {
      // swap ref and query bases
      result += `*${cs[i + 2]}${cs[i + 1]}`
      i += 3
    } else if (ch === '+') {
      // insertion becomes deletion
      i++
      let seq = ''
      while (
        i < cs.length &&
        cs[i] !== ':' &&
        cs[i] !== '*' &&
        cs[i] !== '+' &&
        cs[i] !== '-'
      ) {
        seq += cs[i]
        i++
      }
      result += `-${seq}`
    } else if (ch === '-') {
      // deletion becomes insertion
      i++
      let seq = ''
      while (
        i < cs.length &&
        cs[i] !== ':' &&
        cs[i] !== '*' &&
        cs[i] !== '+' &&
        cs[i] !== '-'
      ) {
        seq += cs[i]
        i++
      }
      result += `+${seq}`
    } else {
      i++
    }
  }
  return result
}

interface SubAlignment {
  cols: string[]
  record: AlignmentRecord
}

type WriteFunc = (line: string) => Promise<void>

async function writePairAlignments(
  lines: string[],
  write: WriteFunc,
  splitThreshold: number,
  mergeGap: number,
  prefix: string,
): Promise<void> {
  const allSubAlignments: SubAlignment[] = []

  for (const line of lines) {
    const columns = line.split('\t')
    for (const cols of splitAlignmentByCigar(columns, splitThreshold)) {
      const [c1, l1, s1, e1, strand, c2, l2, , , ...rest] = cols
      const summaryRest = stripDetailFromRest(rest)
      allSubAlignments.push({
        cols,
        record: {
          qname: c1!,
          qlen: l1!,
          qstart: +s1!,
          qend: +e1!,
          strand: strand!,
          tname: c2!,
          tlen: l2!,
          tstart: +cols[7]!,
          tend: +cols[8]!,
          numMatches: +(summaryRest[0] ?? 0),
          blockLen: +(summaryRest[1] ?? 1),
        },
      })
    }
  }

  const syriTypes = computeSyriTypes(
    allSubAlignments.map(sa => ({
      qname: sa.record.qname,
      qstart: sa.record.qstart,
      qend: sa.record.qend,
      tname: sa.record.tname,
      tstart: sa.record.tstart,
      tend: sa.record.tend,
      strand: sa.record.strand === '-' ? -1 : 1,
    })),
  )

  const minSummaryIndel = Math.max(Math.floor(splitThreshold / 2), 100)

  for (let i = 0; i < allSubAlignments.length; i++) {
    const { cols } = allSubAlignments[i]!
    const syriType = syriTypes[i]!
    const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = cols
    const typeTag = `sy:Z:${syriType}`

    const cigarField = rest.find(f => f.startsWith('cg:Z:'))
    const summaryRest = stripDetailFromRest(rest)
    if (cigarField) {
      const indelTag = extractLargeIndels(
        cigarField.slice(5),
        minSummaryIndel,
        +s2!,
        +s1!,
      )
      if (indelTag) {
        summaryRest.push(indelTag)
      }
    }

    await write(
      `${[`t${prefix}${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest, typeTag].join('\t')}\n`,
    )
    await write(
      `${[`st${prefix}${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...summaryRest, typeTag].join('\t')}\n`,
    )

    const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z:'))
    const CIGAR = rest[cigarIdx]
    if (CIGAR) {
      rest[cigarIdx] =
        `cg:Z:${strand === '-' ? flipCigar(parseCigar(CIGAR.slice(5))).join('') : swapIndelCigar(CIGAR.slice(5))}`
    }

    const csIdx = rest.findIndex(f => f.startsWith('cs:Z:'))
    if (csIdx !== -1) {
      rest[csIdx] = `cs:Z:${flipCs(rest[csIdx]!.slice(5))}`
    }

    const qSummaryRest = stripDetailFromRest(rest)
    if (cigarField) {
      const qCigarStr = rest[cigarIdx]
      if (qCigarStr) {
        const qIndelTag = extractLargeIndels(
          qCigarStr.slice(5),
          minSummaryIndel,
          +s1!,
          +s2!,
        )
        if (qIndelTag) {
          qSummaryRest.push(qIndelTag)
        }
      }
    }

    await write(
      `${[`q${prefix}${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest, typeTag].join('\t')}\n`,
    )
    await write(
      `${[`sq${prefix}${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...qSummaryRest, typeTag].join('\t')}\n`,
    )
  }

  if (mergeGap > 0) {
    const blocks = mergeIntoStructuralBlocks(
      allSubAlignments.map(sa => sa.record),
      mergeGap,
    )
    for (const b of blocks) {
      await write(
        `${[`xt${prefix}${b.tname}`, b.tlen, b.tstart, b.tend, b.strand, b.qname, b.qlen, b.qstart, b.qend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
      )
      await write(
        `${[`xq${prefix}${b.qname}`, b.qlen, b.qstart, b.qend, b.strand, b.tname, b.tlen, b.tstart, b.tend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
      )
    }
  }
}

export async function createPIF(
  filename: string | undefined,
  stream: WritableStream,
  splitThreshold = 10000,
  mergeGap = 50000,
): Promise<void> {
  const rl = filename ? getReadline(filename) : getStdReadline()
  const lines: string[] = []
  try {
    for await (const line of rl) {
      lines.push(line)
    }
  } finally {
    rl.close()
  }
  await createPIFFromLines(lines, stream, splitThreshold, mergeGap)
}

export async function createPIFFromLines(
  lines: string[],
  stream: WritableStream,
  splitThreshold = 10000,
  mergeGap = 50000,
): Promise<void> {
  const write = createWriteWithBackpressure(stream)
  try {
    await write(`#splitThreshold=${splitThreshold}\n`)
    await write(`#mergeGap=${mergeGap}\n`)
    await writePairAlignments(lines, write, splitThreshold, mergeGap, '')
  } catch (error) {
    console.error('Error processing records:', error)
    throw error
  }
}

export async function createMultiPairPIF(
  pairData: { lines: string[]; assemblyNames: [string, string] }[],
  stream: WritableStream,
  splitThreshold = 10000,
  mergeGap = 50000,
): Promise<void> {
  const write = createWriteWithBackpressure(stream)
  try {
    await write(`#splitThreshold=${splitThreshold}\n`)
    await write(`#mergeGap=${mergeGap}\n`)
    await write(`#pairs=${pairData.length}\n`)
    for (let p = 0; p < pairData.length; p++) {
      await write(`#pair${p}=${pairData[p]!.assemblyNames.join(',')}\n`)
    }
    for (let p = 0; p < pairData.length; p++) {
      await writePairAlignments(
        pairData[p]!.lines,
        write,
        splitThreshold,
        mergeGap,
        `${p}`,
      )
    }
  } catch (error) {
    console.error('Error processing multi-pair records:', error)
    throw error
  }
}

export function spawnSortProcess(outputFile: string, useCsi: boolean) {
  const sortCmd = `sort -t"\`printf '\\t'\`" -k1,1 -k3,3n`
  const bgzipCommand = `bgzip > "${outputFile}"`
  const tabixCommand = `tabix ${useCsi ? '-C ' : ''}-s1 -b3 -e4 -0 "${outputFile}"`
  const fullCommand = `${sortCmd} | ${bgzipCommand}; ${tabixCommand}`
  const minimalEnv = {
    ...process.env,
    LC_ALL: 'C',
  }
  return spawn('sh', ['-c', fullCommand], {
    env: minimalEnv,
    stdio: ['pipe', process.stdout, process.stderr],
  })
}

export function getOutputFilename(
  file: string | undefined,
  out?: string,
): string {
  return out || `${path.basename(file || 'output', '.paf')}.pif.gz`
}
