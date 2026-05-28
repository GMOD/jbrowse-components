import { spawn } from 'child_process'
import path from 'path'

import { flipCigar, parseCigar, swapIndelCigar } from './cigar-utils.ts'
import {
  createWriteWithBackpressure,
  getReadline,
  getStdReadline,
} from './file-utils.ts'
import { mergeIntoBlocks } from './structural-summary.ts'

import type { WritableStream } from './file-utils.ts'
import type { AlignmentRecord } from './structural-summary.ts'

export async function createPIF(
  filename: string | undefined,
  stream: WritableStream,
  mergeGap = 0,
): Promise<void> {
  const rl1 = filename ? getReadline(filename) : getStdReadline()
  const writeWithBackpressure = createWriteWithBackpressure(stream)
  const records: AlignmentRecord[] = []

  try {
    for await (const line of rl1) {
      const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')

      await writeWithBackpressure(
        `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t')}\n`,
      )

      const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z'))
      const CIGAR = rest[cigarIdx]
      if (CIGAR) {
        rest[cigarIdx] = `cg:Z:${
          strand === '-'
            ? flipCigar(parseCigar(CIGAR.slice(5))).join('')
            : swapIndelCigar(CIGAR.slice(5))
        }`
      }

      await writeWithBackpressure(
        `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t')}\n`,
      )

      if (mergeGap > 0) {
        records.push({
          qname: c1!,
          qlen: l1!,
          qstart: +s1!,
          qend: +e1!,
          strand: strand!,
          tname: c2!,
          tlen: l2!,
          tstart: +s2!,
          tend: +e2!,
          numMatches: +(rest[0] ?? 0),
          blockLen: +(rest[1] ?? 1),
        })
      }
    }
  } catch (error) {
    console.error('Error processing PAF file:', error)
    throw error
  } finally {
    rl1.close()
  }

  if (mergeGap > 0 && records.length > 0) {
    const blocks = mergeIntoBlocks(records, mergeGap)
    for (const b of blocks) {
      const mq = '60'
      const de = b.blockLen > 0 ? 1 - b.numMatches / b.blockLen : 0
      const deTag = `de:f:${de.toFixed(6)}`
      await writeWithBackpressure(
        `${[`T${b.tname}`, b.tlen, b.tstart, b.tend, b.strand, b.qname, b.qlen, b.qstart, b.qend, b.numMatches, b.blockLen, mq, deTag].join('\t')}\n`,
      )
      await writeWithBackpressure(
        `${[`Q${b.qname}`, b.qlen, b.qstart, b.qend, b.strand, b.tname, b.tlen, b.tstart, b.tend, b.numMatches, b.blockLen, mq, deTag].join('\t')}\n`,
      )
    }
  }
}

export function spawnSortProcess(outputFile: string, useCsi: boolean) {
  // Use a more portable approach to avoid E2BIG errors

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
