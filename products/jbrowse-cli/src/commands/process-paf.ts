import fs from 'fs'
import JBrowseCommand from '../base'

import readline from 'readline'
import { createGunzip } from 'zlib'

function getReadline(filename: string) {
  const stream = fs.createReadStream(filename)
  return readline.createInterface({
    input: filename.match(/.b?gz$/) ? stream.pipe(createGunzip()) : stream,
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

export default class ProcessPAF extends JBrowseCommand {
  // @ts-expect-error
  target: string

  static description = 'Pairwise index the PAF'

  static examples = [
    '# processes a local PAF file into our custom format PPAF, which pairwise indexes the PAF',
    '$ jbrowse process-paf file.paf > output.ppaf',
  ]

  static args = [
    {
      name: 'track',
      required: true,
      description: `Track file or URL`,
    },
  ]

  async run() {
    const { args: runArgs } = this.parse(ProcessPAF)

    const { track: filename } = runArgs

    const rl1 = getReadline(filename)
    for await (const line of rl1) {
      // eslint-disable-next-line no-console
      console.log(`q${line}`)
    }
    rl1.close()

    const rl2 = getReadline(filename)
    for await (const line of rl2) {
      const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')
      const cigarIdx = rest.findIndex(f => f.startsWith('cg:Z'))

      const CIGAR = rest[cigarIdx]
      if (CIGAR) {
        rest[cigarIdx] = `cg:Z:${
          strand === '-'
            ? flipCigar(parseCigar(CIGAR.slice(5))).join('')
            : swapIndelCigar(CIGAR.slice(5))
        }`
      }

      // eslint-disable-next-line no-console
      console.log(
        [`t${c2}`, l2, s2, e2, strand, c1, l1, s1, e1, ...rest].join('\t'),
      )
    }
    rl2.close()
  }
}
