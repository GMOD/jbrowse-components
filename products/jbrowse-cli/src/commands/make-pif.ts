import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { createGunzip } from 'zlib'
import { Args, Flags } from '@oclif/core'
import { sync as commandExistsSync } from 'command-exists'

import JBrowseCommand from '../base'

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
  stream: { write: (arg: string) => void },
) {
  const rl1 = filename ? getReadline(filename) : getStdReadline()
  for await (const line of rl1) {
    const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')

    stream.write(
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

    stream.write(
      `${[`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t')}\n`,
    )
  }
  rl1.close()
}

export default class MakePIF extends JBrowseCommand {
  static description =
    'creates pairwise indexed PAF (PIF), with bgzip and tabix'

  static examples = [
    '$ jbrowse pif input.paf # creates input.pif.gz in same directory',
    '',
    '$ jbrowse pif input.paf --out output.pif.gz # specify output file, creates output.pif.gz.tbi also',
  ]

  static flags = {
    out: Flags.string({
      description:
        'Where to write the output file. will write ${file}.pif.gz and ${file}.pif.gz.tbi',
    }),
    csi: Flags.boolean({
      description: 'Create a CSI index for the PIF file instead of TBI',
    }),
    help: Flags.help({ char: 'h' }),
  }
  static args = {
    file: Args.string({
      required: true,
      description: 'PAF file as input',
    }),
  }

  async run() {
    const {
      args: { file },
      flags: { out, csi },
    } = await this.parse(MakePIF)

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
      throw new Error(
        'Unable to sort, requires unix type environment with sort, grep, bgzip, tabix',
      )
    }
  }
}
