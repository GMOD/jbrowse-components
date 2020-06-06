export interface Mismatch {
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}

export function parseCigar(cigar: string) {
  return cigar.split(/([MIDNSHPX=])/)
}
export function cigarToMismatches(ops: string[], seq: string): Mismatch[] {
  let currOffset = 0
  let seqOffset = 0
  const mismatches: Mismatch[] = []
  for (let i = 0; i < ops.length - 1; i += 2) {
    const len = +ops[i]
    const op = ops[i + 1]
    if (op === 'M' || op === '=' || op === 'E') {
      seqOffset += len
    }
    if (op === 'I') {
      // GAH: shouldn't length of insertion really by 0, since JBrowse internally uses zero-interbase coordinates?
      mismatches.push({
        start: currOffset,
        type: 'insertion',
        base: `${len}`,
        length: 1,
      })
      seqOffset += len
    } else if (op === 'D') {
      mismatches.push({
        start: currOffset,
        type: 'deletion',
        base: '*',
        length: len,
      })
    } else if (op === 'N') {
      mismatches.push({
        start: currOffset,
        type: 'skip',
        base: 'N',
        length: len,
      })
    } else if (op === 'X') {
      const r = seq.slice(seqOffset, seqOffset + len)
      for (let j = 0; j < len; j++) {
        mismatches.push({
          start: currOffset + j,
          type: 'mismatch',
          base: r[j],
          length: 1,
        })
      }
      seqOffset += len
    } else if (op === 'H') {
      mismatches.push({
        start: currOffset,
        type: 'hardclip',
        base: `H${len}`,
        cliplen: len,
        length: 1,
      })
    } else if (op === 'S') {
      mismatches.push({
        start: currOffset,
        type: 'softclip',
        base: `S${len}`,
        cliplen: len,
        length: 1,
      })
      seqOffset += len
    }

    if (op !== 'I' && op !== 'S' && op !== 'H') {
      currOffset += len
    }
  }
  return mismatches
}

/**
 * parse a SAM MD tag to find mismatching bases of the template versus the reference
 * @returns array of mismatches and their positions
 */
export function mdToMismatches(
  mdstring: string,
  cigarOps: string[],
  cigarMismatches: Mismatch[],
  seq: string,
): Mismatch[] {
  const mismatchRecords: Mismatch[] = []
  let curr: Mismatch = { start: 0, base: '', length: 0, type: 'mismatch' }

  // convert a position on the reference sequence to a position
  // on the template sequence, taking into account hard and soft
  // clipping of reads

  function nextRecord(): void {
    // correct the start of the current mismatch if it comes after a cigar skip
    ;(cigarMismatches || []).forEach((mismatch: Mismatch) => {
      if (mismatch.type === 'skip' && curr.start >= mismatch.start) {
        curr.start += mismatch.length
      }
    })

    // record it
    mismatchRecords.push(curr)

    // get a new mismatch record ready
    curr = {
      start: curr.start + curr.length,
      length: 0,
      base: '',
      type: 'mismatch',
    }
  }

  // now actually parse the MD string
  ;(mdstring.match(/(\d+|\^[a-z]+|[a-z])/gi) || []).forEach(token => {
    if (token.match(/^\d/)) {
      // matching bases
      curr.start += parseInt(token, 10)
    } else if (token.match(/^\^/)) {
      // insertion in the template
      curr.length = token.length - 1
      curr.base = '*'
      curr.type = 'deletion'
      curr.seq = token.substring(1)
      nextRecord()
    } else if (token.match(/^[a-z]/i)) {
      // mismatch
      for (let j = 0; j < token.length; j += 1) {
        curr.length = 1
        curr.base = seq
          ? seq.substr(
              cigarOps ? getTemplateCoord(curr.start, cigarOps) : curr.start,
              1,
            )
          : 'X'
        curr.altbase = token
        nextRecord()
      }
    }
  })
  return mismatchRecords
}

export function getTemplateCoord(refCoord: number, cigarOps: string[]): number {
  let templateOffset = 0
  let refOffset = 0
  for (let i = 0; i < cigarOps.length && refOffset <= refCoord; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op === 'S' || op === 'I') {
      templateOffset += len
    } else if (op === 'D' || op === 'P') {
      refOffset += len
    } else if (op !== 'H') {
      templateOffset += len
      refOffset += len
    }
  }
  return templateOffset - (refOffset - refCoord)
}
