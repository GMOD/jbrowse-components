import fs from 'fs'
import readline from 'readline'
import { createGunzip } from 'zlib'
import { Args, Flags } from '@oclif/core'
import { sync as commandExistsSync } from 'command-exists'
import { spawn } from 'child_process'
import path from 'path'

import JBrowseCommand from '../base'

const cigarRegex = new RegExp(/([MIDNSHPX=])/)

function getReadline(filename: string) {
  const stream = fs.createReadStream(filename)
  return readline.createInterface({
    input: filename.match(/.b?gz$/) ? stream.pipe(createGunzip()) : stream,
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

export async function createPIF(filename?: string, child: { stdin: any }) {
  const rl1 = filename ? getReadline(filename) : getStdReadline()
  for await (const line of rl1) {
    const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')

    child.stdin.write(
      [`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t') + '\n',
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

    child.stdin.write(
      [`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t') + '\n',
    )
  }
  rl1.close()
}

export default class CreatePIF extends JBrowseCommand {
  static description =
    'creates pairwise indexed PAF (PIF), with bgzip and tabix'

  static examples = [
    '$ jbrowse create-pif input.paf # creates input.pif.gz in same directory',
    '',
    '$ jbrowse create-pif input.paf --out output.pif.gz # specify output file, creates output.pif.gz.tbi also',
  ]

  static flags = {
    out: Flags.string({
      description:
        'Where to write the output file. If unspecified, will be ${file}.pif.gz',
    }),
    csi: Flags.string({
      description: 'Create a CSI index for the PIF file instead of TBI',
    }),
    help: Flags.help({ char: 'h' }),
  }
  static args = {
    file: Args.string({
      required: true,
      description: `PAF file as input`,
    }),
  }

  async run() {
    try {
      const {
        args: { file },
        flags: { out, csi },
      } = await this.parse(CreatePIF)

      if (
        commandExistsSync('sh') &&
        commandExistsSync('sort') &&
        commandExistsSync('grep') &&
        commandExistsSync('tabix') &&
        commandExistsSync('bgzip')
      ) {
        const fn = out || `${path.basename(file, '.paf')}.pif.gz`
        console.error('start')
        const child = spawn(
          'sh',
          [
            '-c',
            `sort -t"\`printf '\t'\`" -k1,1 -k3,3n ${fn} | bgzip > ${fn}; tabix -s1 -b3 -e4 ${fn}`,
          ],
          {
            env: { ...process.env, LC_ALL: 'C' },
            stdio: 'inherit',
          },
        )
        await createPIF(fn, child)
      } else {
        throw new Error(
          'Unable to sort, requires unix type environment with sort, grep, bgzip, tabix',
        )
      }
    } catch (e) {
      console.error(e)
    }
  }
}
