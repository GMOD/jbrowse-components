import { spawn } from 'child_process'
import path from 'path'

import { flipCigar, parseCigar, swapIndelCigar } from './cigar-utils.ts'
import {
  createWriteWithBackpressure,
  getReadline,
  getStdReadline,
} from './file-utils.ts'
import { computeSyriTypesMap, parsePAFLineForSyri } from './syri-utils.ts'

import type { WritableStream } from './file-utils.ts'
import type { PAFRecord } from './syri-utils.ts'

export async function createPIF(
  filename: string | undefined,
  stream: WritableStream,
): Promise<void> {
  // First pass: read all records to compute syri types
  console.error('Computing SyRI classifications...')
  const rl1 = filename ? getReadline(filename) : getStdReadline()
  const records: PAFRecord[] = []
  const lines: string[] = []

  let index = 0
  for await (const line of rl1) {
    lines.push(line)
    records.push(parsePAFLineForSyri(line, index))
    index++
  }
  rl1.close()

  // Compute syri types from full dataset
  const syriTypes = computeSyriTypesMap(records)
  console.error(`Computed SyRI types for ${records.length} records`)

  // Second pass: write output with syri types
  const writeWithBackpressure = createWriteWithBackpressure(stream)

  try {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const syriType = syriTypes.get(i) || 'SYN'
      const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')

      // Add syriType as a PAF optional field
      const syriField = `sy:Z:${syriType}`

      // Write the first line (target-oriented) and handle backpressure
      await writeWithBackpressure(
        `${[`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest, syriField].join('\t')}\n`,
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

      // Write the second line (query-oriented) and handle backpressure
      await writeWithBackpressure(
        `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest, syriField].join('\t')}\n`,
      )
    }
  } catch (error) {
    console.error('Error processing PAF file:', error)
    throw error
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
