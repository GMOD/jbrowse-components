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

export async function createPIF(
  filename: string | undefined,
  stream: WritableStream,
  splitThreshold = 10000,
  mergeGap = 50000,
): Promise<void> {
  const rl1 = filename ? getReadline(filename) : getStdReadline()
  const writeWithBackpressure = createWriteWithBackpressure(stream)

  // Two-pass: first collect all sub-alignments, then classify, then write
  const allSubAlignments: SubAlignment[] = []

  try {
    for await (const line of rl1) {
      const columns = line.split('\t')
      const subAlignments = splitAlignmentByCigar(columns, splitThreshold)

      for (const cols of subAlignments) {
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

    // Classify all alignments
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

    // Write header
    await writeWithBackpressure(`#splitThreshold=${splitThreshold}\n`)
    await writeWithBackpressure(`#mergeGap=${mergeGap}\n`)

    // Minimum indel size for summary tier large-indel extraction
    // Use half the split threshold so summary tier shows structural events
    const minSummaryIndel = Math.max(Math.floor(splitThreshold / 2), 100)

    // Write all alignment lines with syriType tag
    for (let i = 0; i < allSubAlignments.length; i++) {
      const { cols } = allSubAlignments[i]!
      const syriType = syriTypes[i]!
      const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = cols
      const typeTag = `sy:Z:${syriType}`

      // Extract large indels for summary tier (absolute positions, not CIGAR)
      const cigarField = rest.find(f => f.startsWith('cg:Z:'))
      const summaryRest = stripDetailFromRest(rest)
      if (cigarField) {
        // For target-perspective summary: indel positions relative to target start
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

      // t-prefix line (full, with CIGAR)
      await writeWithBackpressure(
        `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest, typeTag].join('\t')}\n`,
      )

      // st-prefix line (summary, large indel positions instead of full CIGAR)
      await writeWithBackpressure(
        `${[`st${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...summaryRest, typeTag].join('\t')}\n`,
      )

      const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z:'))
      const CIGAR = rest[cigarIdx]
      if (CIGAR) {
        rest[cigarIdx] = `cg:Z:${
          strand === '-'
            ? flipCigar(parseCigar(CIGAR.slice(5))).join('')
            : swapIndelCigar(CIGAR.slice(5))
        }`
      }

      // Flip cs tag for query perspective (swap I↔D, swap ref/query bases)
      const csIdx = rest.findIndex(f => f.startsWith('cs:Z:'))
      if (csIdx !== -1) {
        rest[csIdx] = `cs:Z:${flipCs(rest[csIdx]!.slice(5))}`
      }

      // Recompute indel positions for query-perspective summary
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

      // q-prefix line (full, with CIGAR)
      await writeWithBackpressure(
        `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest, typeTag].join('\t')}\n`,
      )

      // sq-prefix line (summary, large indel positions)
      await writeWithBackpressure(
        `${[`sq${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...qSummaryRest, typeTag].join('\t')}\n`,
      )
    }

    // Generate structural summary lines (xt/xq prefix)
    if (mergeGap > 0) {
      const blocks = mergeIntoStructuralBlocks(
        allSubAlignments.map(sa => sa.record),
        mergeGap,
      )
      for (const b of blocks) {
        await writeWithBackpressure(
          `${[`xt${b.tname}`, b.tlen, b.tstart, b.tend, b.strand, b.qname, b.qlen, b.qstart, b.qend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
        )

        await writeWithBackpressure(
          `${[`xq${b.qname}`, b.qlen, b.qstart, b.qend, b.strand, b.tname, b.tlen, b.tstart, b.tend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
        )
      }
    }
  } catch (error) {
    console.error('Error processing PAF file:', error)
    throw error
  } finally {
    rl1.close()
  }
}

// Variant that accepts pre-parsed PAF lines (from format converters)
// instead of reading from a file
export async function createPIFFromLines(
  lines: string[],
  stream: WritableStream,
  splitThreshold = 10000,
  mergeGap = 50000,
): Promise<void> {
  const writeWithBackpressure = createWriteWithBackpressure(stream)
  const allSubAlignments: SubAlignment[] = []

  try {
    for (const line of lines) {
      const columns = line.split('\t')
      const subAlignments = splitAlignmentByCigar(columns, splitThreshold)

      for (const cols of subAlignments) {
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

    await writeWithBackpressure(`#splitThreshold=${splitThreshold}\n`)
    await writeWithBackpressure(`#mergeGap=${mergeGap}\n`)

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

      await writeWithBackpressure(
        `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest, typeTag].join('\t')}\n`,
      )
      await writeWithBackpressure(
        `${[`st${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...summaryRest, typeTag].join('\t')}\n`,
      )

      const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z:'))
      const CIGAR = rest[cigarIdx]
      if (CIGAR) {
        rest[cigarIdx] =
          `cg:Z:${strand === '-' ? flipCigar(parseCigar(CIGAR.slice(5))).join('') : swapIndelCigar(CIGAR.slice(5))}`
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

      await writeWithBackpressure(
        `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest, typeTag].join('\t')}\n`,
      )
      await writeWithBackpressure(
        `${[`sq${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...qSummaryRest, typeTag].join('\t')}\n`,
      )
    }

    if (mergeGap > 0) {
      const blocks = mergeIntoStructuralBlocks(
        allSubAlignments.map(sa => sa.record),
        mergeGap,
      )
      for (const b of blocks) {
        await writeWithBackpressure(
          `${[`xt${b.tname}`, b.tlen, b.tstart, b.tend, b.strand, b.qname, b.qlen, b.qstart, b.qend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
        )
        await writeWithBackpressure(
          `${[`xq${b.qname}`, b.qlen, b.qstart, b.qend, b.strand, b.tname, b.tlen, b.tstart, b.tend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
        )
      }
    }
  } catch (error) {
    console.error('Error processing records:', error)
    throw error
  }
}

// Creates a multi-pair PIF from multiple sets of PAF lines, one per pair.
// Each pair gets a numeric index in the prefix: t0, q0, st0, sq0, xt0, xq0, t1, q1, etc.
export async function createMultiPairPIF(
  pairData: {
    lines: string[]
    assemblyNames: [string, string]
  }[],
  stream: WritableStream,
  splitThreshold = 10000,
  mergeGap = 50000,
): Promise<void> {
  const writeWithBackpressure = createWriteWithBackpressure(stream)

  try {
    await writeWithBackpressure(`#splitThreshold=${splitThreshold}\n`)
    await writeWithBackpressure(`#mergeGap=${mergeGap}\n`)
    await writeWithBackpressure(`#pairs=${pairData.length}\n`)
    for (let p = 0; p < pairData.length; p++) {
      const pair = pairData[p]!
      await writeWithBackpressure(`#pair${p}=${pair.assemblyNames.join(',')}\n`)
    }

    for (let p = 0; p < pairData.length; p++) {
      const { lines } = pairData[p]!
      const allSubAlignments: SubAlignment[] = []

      for (const line of lines) {
        const columns = line.split('\t')
        const subAlignments = splitAlignmentByCigar(columns, splitThreshold)

        for (const cols of subAlignments) {
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

        await writeWithBackpressure(
          `${[`t${p}${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest, typeTag].join('\t')}\n`,
        )
        await writeWithBackpressure(
          `${[`st${p}${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...summaryRest, typeTag].join('\t')}\n`,
        )

        const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z:'))
        const CIGAR = rest[cigarIdx]
        if (CIGAR) {
          rest[cigarIdx] =
            `cg:Z:${strand === '-' ? flipCigar(parseCigar(CIGAR.slice(5))).join('') : swapIndelCigar(CIGAR.slice(5))}`
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

        await writeWithBackpressure(
          `${[`q${p}${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest, typeTag].join('\t')}\n`,
        )
        await writeWithBackpressure(
          `${[`sq${p}${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...qSummaryRest, typeTag].join('\t')}\n`,
        )
      }

      if (mergeGap > 0) {
        const blocks = mergeIntoStructuralBlocks(
          allSubAlignments.map(sa => sa.record),
          mergeGap,
        )
        for (const b of blocks) {
          await writeWithBackpressure(
            `${[`xt${p}${b.tname}`, b.tlen, b.tstart, b.tend, b.strand, b.qname, b.qlen, b.qstart, b.qend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
          )
          await writeWithBackpressure(
            `${[`xq${p}${b.qname}`, b.qlen, b.qstart, b.qend, b.strand, b.tname, b.tlen, b.tstart, b.tend, b.syriType, b.meanIdentity.toFixed(4)].join('\t')}\n`,
          )
        }
      }
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

export async function waitForProcessClose(child: any): Promise<void> {
  return new Promise(resolve => {
    child.on('close', resolve)
  })
}
