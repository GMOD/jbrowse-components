import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { createGunzip } from 'zlib'
import { parseArgs } from 'util'

import { sync as commandExistsSync } from 'command-exists'

import NativeCommand from '../native-base'

const cigarRegex = new RegExp(/([MIDNSHPX=])/)

function getReadline(filename: string) {
  const stream = fs.createReadStream(filename)
  return readline.createInterface({
    input: /.b?gz$/.exec(filename) ? stream.pipe(createGunzip()) : stream,
  })
}

function getStdReadline() {
  return readline.createInterface({
    input: process.stdin,
  })
}

function parseCigar(cigar = '') {
  return cigar.split(cigarRegex).slice(0, -1)
}

export function flipCigar(cigar: string[]) {
  const arr = []
  for (let i = cigar.length - 2; i >= 0; i -= 2) {
    arr.push(cigar[i])
    const op = cigar[i + 1]
    if (op === 'D') {
      arr.push('I')
    } else if (op === 'I') {
      arr.push('D')
    } else {
      arr.push(op)
    }
  }
  return arr
}

export function swapIndelCigar(cigar: string) {
  return cigar.replaceAll('D', 'K').replaceAll('I', 'D').replaceAll('K', 'I')
}

export async function createPIF(
  filename: string | undefined,
  stream: { write: (arg: string) => boolean },
) {
  const rl1 = filename ? getReadline(filename) : getStdReadline()

  // Properly handle backpressure by creating a promise-based write function
  const writeWithBackpressure = (data: string): Promise<void> => {
    // If the stream buffer is full (write returns false), we need to wait for drain
    if (!stream.write(data)) {
      return new Promise(resolve => {
        const drainHandler = () => {
          // @ts-expect-error - assuming stream is a Writable
          stream.removeListener('drain', drainHandler)
          resolve()
        }
        // @ts-expect-error - assuming stream is a Writable
        stream.once('drain', drainHandler)
      })
    }
    // If write returns true, the buffer is not full, so we can continue immediately
    return Promise.resolve()
  }

  // Process the file line by line with backpressure handling
  try {
    for await (const line of rl1) {
      const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')

      // Write the first line and handle backpressure
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

      // Write the second line and handle backpressure
      await writeWithBackpressure(
        `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t')}\n`,
      )
    }
  } catch (error) {
    console.error('Error processing PAF file:', error)
    throw error
  } finally {
    rl1.close()
  }
}

export default class MakePIFNative extends NativeCommand {
  static description = 'creates pairwise indexed PAF (PIF), with bgzip and tabix'

  static examples = [
    '$ jbrowse make-pif input.paf # creates input.pif.gz in same directory',
    '',
    '$ jbrowse make-pif input.paf --out output.pif.gz # specify output file, creates output.pif.gz.tbi also',
  ]

  async run() {
    const { values: flags, positionals } = parseArgs({
      args: process.argv.slice(3), // Skip node, script, and command name
      options: {
        help: {
          type: 'boolean',
          short: 'h',
          default: false,
        },
        out: {
          type: 'string',
        },
        csi: {
          type: 'boolean',
          default: false,
        },
      },
      allowPositionals: true,
    })

    if (flags.help) {
      this.showHelp()
      return
    }

    const file = positionals[0]
    if (!file) {
      console.error('Error: Missing required argument: file')
      console.error('Usage: jbrowse make-pif <file> [options]')
      process.exit(1)
    }

    const { out, csi } = flags

    if (
      commandExistsSync('sh') &&
      commandExistsSync('sort') &&
      commandExistsSync('grep') &&
      commandExistsSync('tabix') &&
      commandExistsSync('bgzip')
    ) {
      const fn = out || `${path.basename(file || 'output', '.paf')}.pif.gz`
      const child = spawn(
        'sh',
        [
          '-c',
          `sort -t"\`printf '\t'\`" -k1,1 -k3,3n | bgzip > ${fn}; tabix ${
            csi ? '-C ' : ''
          }-s1 -b3 -e4 -0 ${fn}`,
        ],
        {
          env: { ...process.env, LC_ALL: 'C' },
          stdio: ['pipe', process.stdout, process.stderr],
        },
      )
      await createPIF(file, child.stdin)
      child.stdin.end()
      await new Promise(resolve => {
        child.on('close', resolve)
      })
    } else {
      console.error(
        'Error: Unable to sort, requires unix type environment with sort, grep, bgzip, tabix',
      )
      process.exit(1)
    }
  }

  showHelp() {
    console.log(`
${MakePIFNative.description}

USAGE
  $ jbrowse make-pif <file> [options]

ARGUMENTS
  file  PAF file as input

OPTIONS
  -h, --help       Show help
  --out <out>      Where to write the output file. will write \${file}.pif.gz and \${file}.pif.gz.tbi
  --csi            Create a CSI index for the PIF file instead of TBI

EXAMPLES
${MakePIFNative.examples.join('\n')}
`)
  }
}