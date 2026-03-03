import { spawn } from 'child_process'
import path from 'path'

import {
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

import type { WritableStream } from './file-utils.ts'

function stripCigarFromRest(rest: string[]) {
  return rest.filter(f => !f.startsWith('cg:Z:'))
}

export async function createPIF(
  filename: string | undefined,
  stream: WritableStream,
  splitThreshold = 10000,
): Promise<void> {
  const rl1 = filename ? getReadline(filename) : getStdReadline()
  const writeWithBackpressure = createWriteWithBackpressure(stream)

  try {
    for await (const line of rl1) {
      const columns = line.split('\t')
      const subAlignments = splitAlignmentByCigar(columns, splitThreshold)

      for (const cols of subAlignments) {
        const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = cols

        // t-prefix line (full, with CIGAR)
        await writeWithBackpressure(
          `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t')}\n`,
        )

        // st-prefix line (summary, no CIGAR)
        const summaryRestT = stripCigarFromRest(rest)
        await writeWithBackpressure(
          `${[`st${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...summaryRestT].join('\t')}\n`,
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

        // q-prefix line (full, with CIGAR)
        await writeWithBackpressure(
          `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t')}\n`,
        )

        // sq-prefix line (summary, no CIGAR)
        const summaryRestQ = stripCigarFromRest(rest)
        await writeWithBackpressure(
          `${[`sq${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...summaryRestQ].join('\t')}\n`,
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
