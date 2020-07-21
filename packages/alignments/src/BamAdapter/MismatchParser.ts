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
  return (cigar || '').split(/([MIDNSHPX=])/)
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
  const hasSkip = cigarMismatches.find(cigar => cigar.type === 'skip')
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0

  // convert a position on the reference sequence to a position
  // on the template sequence, taking into account hard and soft
  // clipping of reads

  function nextRecord(): void {
    // correct the start of the current mismatch if it comes after a cigar skip
    if (hasSkip) {
      cigarMismatches.forEach((mismatch: Mismatch) => {
        if (mismatch.type === 'skip' && curr.start >= mismatch.start) {
          curr.start += mismatch.length
        }
      })
    }

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

  function getTemplateCoordLocal(refCoord: number): number {
    let templateOffset = lastTemplateOffset
    let refOffset = lastRefOffset
    for (
      let i = lastCigar;
      i < cigarOps.length && refOffset <= refCoord;
      i += 2, lastCigar = i
    ) {
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
    lastTemplateOffset = templateOffset
    lastRefOffset = refOffset
    return templateOffset - (refOffset - refCoord)
  }

  // now actually parse the MD string
  const md = mdstring.match(/(\d+|\^[a-z]+|[a-z])/gi) || []
  for (let i = 0; i < md.length; i++) {
    const token = md[i]
    if (token.match(/^\d/)) {
      curr.start += parseInt(token, 10)
    } else if (token.match(/^\^/)) {
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
              cigarOps ? getTemplateCoordLocal(curr.start) : curr.start,
              1,
            )
          : 'X'
        curr.altbase = token
        nextRecord()
      }
    }
  }
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

export function getMismatches(
  cigarString: string,
  mdString: string,
  seq: string,
): Mismatch[] {
  let mismatches: Mismatch[] = []
  let cigarOps: string[] = []

  // parse the CIGAR tag if it has one
  if (cigarString) {
    cigarOps = parseCigar(cigarString)
    mismatches = mismatches.concat(cigarToMismatches(cigarOps, seq))
  }

  // now let's look for CRAM or MD mismatches
  if (mdString) {
    mismatches = mismatches.concat(
      mdToMismatches(mdString, cigarOps, mismatches, seq),
    )
  }

  // uniqify the mismatches
  const seen: { [index: string]: boolean } = {}
  return mismatches.filter(m => {
    const key = `${m.type},${m.start},${m.length}`
    const s = seen[key]
    seen[key] = true
    return !s
  })
}

// adapted from minimap2 code static void write_MD_core function
export function generateMD(target: string, query: string, cigar: string) {
  let queryOffset = 0
  let targetOffset = 0
  let lengthMD = 0
  if (!target) {
    console.warn('no ref supplied to generateMD')
    return ''
  }
  const cigarOps = parseCigar(cigar)
  let str = ''
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op === 'M' || op === 'X' || op === '=') {
      for (let j = 0; j < len; j++) {
        if (
          query[queryOffset + j].toLowerCase() !==
          target[targetOffset + j].toLowerCase()
        ) {
          str += `${lengthMD}${target[targetOffset + j].toUpperCase()}`
          lengthMD = 0
        } else {
          lengthMD++
        }
      }
      queryOffset += len
      targetOffset += len
    } else if (op === 'I') {
      queryOffset += len
    } else if (op === 'D') {
      let tmp = ''
      for (let j = 0; j < len; j++) {
        tmp += target[targetOffset + j].toUpperCase()
      }
      str += `${lengthMD}^${tmp}`
      lengthMD = 0
      targetOffset += len
    } else if (op === 'N') {
      targetOffset += len
    } else if (op === 'S') {
      queryOffset += len
    }
  }
  if (lengthMD > 0) {
    str += lengthMD
  }
  return str
}
