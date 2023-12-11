import fs from 'fs'
import JBrowseCommand from '../base'

import readline from 'readline'
import { createGunzip } from 'zlib'
import { Args, Flags } from '@oclif/core'

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

const cigarRegex = new RegExp(/([MIDNSHPX=])/)

export function parseCigar(cigar = '') {
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

export default class CreatePIF extends JBrowseCommand {
  static description = 'Create pairwise indexed PAF file (PIF)'

  static examples = [
    '# processes a local PAF file into our custom format, PIF (pairwise indexed PAF)',
    '',
    '# read from stdin. could also pipe directly from minimap2 here',
    '$ cat file.paf | jbrowse process-paf | sort -k1,1 -k3,3n | bgzip > out.pif.gz',
    '$ tabix out.pif.gz',
    '$ jbrowse add-track out.pif.gz -a mm39,hg38',
    '',
    '# read from file instead of stdin',
    '$ jbrowse process-paf file.paf | sort -k1,1 -k3,3n | bgzip >  out.pif.gz',
    '$ tabix out.pif.gz',
    '$ jbrowse add-track out.pif.gz -a mm39,hg38',
  ]

  static args = {
    track: Args.string({
      description: `Track file (optional, reads from stdin if not specified)`,
    }),
  }

  static flags = {
    help: Flags.help({ char: 'h' }),
  }

  async run() {
    const { args: runArgs } = await this.parse(CreatePIF)
    const { track: filename } = runArgs

    const rl1 = filename ? getReadline(filename) : getStdReadline()
    for await (const line of rl1) {
      const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')

      process.stdout.write(
        [`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t') +
          '\n',
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

      process.stdout.write(
        [`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t') +
          '\n',
      )
    }
    rl1.close()
  }
}
