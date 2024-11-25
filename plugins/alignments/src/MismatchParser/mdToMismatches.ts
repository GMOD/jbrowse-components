import type { Mismatch } from '../shared/types'
import type { Buffer } from 'buffer'

const mdRegex = new RegExp(/(\d+|\^[a-z]+|[a-z])/gi)

export function mdToMismatches(
  mdstring: string,
  ops: string[],
  cigarMismatches: Mismatch[],
  seq: string,
  qual?: Buffer | number[] | null,
) {
  let curr: Mismatch = { start: 0, base: '', length: 0, type: 'mismatch' }
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0
  const mismatchRecords: Mismatch[] = []
  const skips = cigarMismatches.filter(cigar => cigar.type === 'skip')

  // convert a position on the reference sequence to a position on the template
  // sequence, taking into account hard and soft clipping of reads
  function nextRecord(): void {
    mismatchRecords.push(curr)

    // get a new mismatch record ready
    curr = {
      start: curr.start + curr.length,
      length: 0,
      base: '',
      type: 'mismatch',
    }
  }

  function getTemplateCoordLocal(refCoord: number): number {
    let templateOffset = lastTemplateOffset
    let refOffset = lastRefOffset
    for (
      let i = lastCigar;
      i < ops.length && refOffset <= refCoord;
      i += 2, lastCigar = i
    ) {
      const len = +ops[i]!
      const op = ops[i + 1]!

      if (op === 'S' || op === 'I') {
        templateOffset += len
      } else if (op === 'D' || op === 'P' || op === 'N') {
        refOffset += len
      } else if (op !== 'H') {
        templateOffset += len
        refOffset += len
      }
    }
    lastTemplateOffset = templateOffset
    lastRefOffset = refOffset

    return templateOffset - (refOffset - refCoord)
  }

  // now actually parse the MD string
  const md = mdstring.match(mdRegex) || []
  for (const token of md) {
    const num = +token
    if (!Number.isNaN(num)) {
      curr.start += num
    } else if (token.startsWith('^')) {
      curr.start += token.length - 1
    } else {
      // mismatch
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let j = 0; j < token.length; j += 1) {
        curr.length = 1

        while (lastSkipPos < skips.length) {
          const mismatch = skips[lastSkipPos]!
          if (curr.start >= mismatch.start) {
            curr.start += mismatch.length
            lastSkipPos++
          } else {
            break
          }
        }
        const s = getTemplateCoordLocal(curr.start)
        curr.base = seq[s] || 'X'
        curr.qual = qual?.[s]
        curr.altbase = token
        nextRecord()
      }
    }
  }
  return mismatchRecords
}
