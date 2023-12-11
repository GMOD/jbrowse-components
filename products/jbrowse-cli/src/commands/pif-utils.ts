import fs from 'fs'

import readline from 'readline'
import { createGunzip } from 'zlib'

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

export async function createPIF(filename?: string) {
  const rl1 = filename ? getReadline(filename) : getStdReadline()
  for await (const line of rl1) {
    const [c1, l1, s1, e1, strand, c2, l2, s2, e2, ...rest] = line.split('\t')

    process.stdout.write(
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

    process.stdout.write(
      [`q${c1}`, l1, s1, e1, strand, c2, l2, s2, e2, ...rest].join('\t') + '\n',
    )
  }
  rl1.close()
}
