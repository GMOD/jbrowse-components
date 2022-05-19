import { revcom } from '@jbrowse/core/util'
export interface Mismatch {
  qual?: number
  start: number
  length: number
  type: string
  base: string
  altbase?: string
  seq?: string
  cliplen?: number
}
const mdRegex = new RegExp(/(\d+|\^[a-z]+|[a-z])/gi)
export function parseCigar(cigar: string) {
  return (cigar || '').split(/([MIDNSHPX=])/)
}
export function cigarToMismatches(
  ops: string[],
  seq: string,
  ref?: string,
  qual?: Buffer,
): Mismatch[] {
  let roffset = 0 // reference offset
  let soffset = 0 // seq offset
  const mismatches: Mismatch[] = []
  const hasRefAndSeq = ref && seq
  for (let i = 0; i < ops.length; i += 2) {
    const len = +ops[i]
    const op = ops[i + 1]

    if (op === 'M' || op === '=' || op === 'E') {
      if (hasRefAndSeq) {
        for (let j = 0; j < len; j++) {
          if (
            // @ts-ignore in the full yarn build of the repo, this says that object is possibly undefined for some reason, ignored
            seq[soffset + j].toUpperCase() !== ref[roffset + j].toUpperCase()
          ) {
            mismatches.push({
              start: roffset + j,
              type: 'mismatch',
              base: seq[soffset + j],
              length: 1,
            })
          }
        }
      }
      soffset += len
    }
    if (op === 'I') {
      mismatches.push({
        start: roffset,
        type: 'insertion',
        base: `${len}`,
        length: 0,
      })
      soffset += len
    } else if (op === 'D') {
      mismatches.push({
        start: roffset,
        type: 'deletion',
        base: '*',
        length: len,
      })
    } else if (op === 'N') {
      mismatches.push({
        start: roffset,
        type: 'skip',
        base: 'N',
        length: len,
      })
    } else if (op === 'X') {
      const r = seq.slice(soffset, soffset + len)
      const q = qual?.slice(soffset, soffset + len) || []

      for (let j = 0; j < len; j++) {
        mismatches.push({
          start: roffset + j,
          type: 'mismatch',
          base: r[j],
          qual: q[j],
          length: 1,
        })
      }
      soffset += len
    } else if (op === 'H') {
      mismatches.push({
        start: roffset,
        type: 'hardclip',
        base: `H${len}`,
        cliplen: len,
        length: 1,
      })
    } else if (op === 'S') {
      mismatches.push({
        start: roffset,
        type: 'softclip',
        base: `S${len}`,
        cliplen: len,
        length: 1,
      })
      soffset += len
    }

    if (op !== 'I' && op !== 'S' && op !== 'H') {
      roffset += len
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
  ops: string[],
  cigarMismatches: Mismatch[],
  seq: string,
  qual?: Buffer,
): Mismatch[] {
  const mismatchRecords: Mismatch[] = []
  let curr: Mismatch = { start: 0, base: '', length: 0, type: 'mismatch' }
  const skips = cigarMismatches.filter(cigar => cigar.type === 'skip')
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

  // convert a position on the reference sequence to a position
  // on the template sequence, taking into account hard and soft
  // clipping of reads

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
      const len = +ops[i]
      const op = ops[i + 1]

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
  for (let i = 0; i < md.length; i++) {
    const token = md[i]
    const num = +token
    if (!Number.isNaN(num)) {
      curr.start += num
    } else if (token.startsWith('^')) {
      curr.start += token.length - 1
    } else {
      // mismatch
      for (let j = 0; j < token.length; j += 1) {
        curr.length = 1

        while (lastSkipPos < skips.length) {
          const mismatch = skips[lastSkipPos]
          if (curr.start >= mismatch.start) {
            curr.start += mismatch.length
            lastSkipPos++
          } else {
            break
          }
        }
        const s = getTemplateCoordLocal(curr.start)
        curr.base = seq[s] || 'X'
        const qualScore = qual?.[s]
        if (qualScore) {
          curr.qual = qualScore
        }
        curr.altbase = token
        nextRecord()
      }
    }
  }
  return mismatchRecords
}

export function getMismatches(
  cigar: string,
  md: string,
  seq: string,
  ref?: string,
  qual?: Buffer,
): Mismatch[] {
  let mismatches: Mismatch[] = []
  const ops = parseCigar(cigar)

  // parse the CIGAR tag if it has one
  if (cigar) {
    mismatches = mismatches.concat(cigarToMismatches(ops, seq, ref, qual))
  }

  // now let's look for CRAM or MD mismatches
  if (md) {
    mismatches = mismatches.concat(
      mdToMismatches(md, ops, mismatches, seq, qual),
    )
  }

  return mismatches
}
// get relative reference sequence positions for positions given relative to
// the read sequence
export function* getNextRefPos(cigarOps: string[], positions: number[]) {
  let cigarIdx = 0
  let readPos = 0
  let refPos = 0
  console.log({ cigarOps, positions })

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    for (; cigarIdx < cigarOps.length && readPos < pos; cigarIdx += 2) {
      const len = +cigarOps[cigarIdx]
      const op = cigarOps[cigarIdx + 1]
      if (op === 'S' || op === 'I') {
        readPos += len
      } else if (op === 'D' || op === 'N') {
        refPos += len
      } else if (op === 'M' || op === 'X' || op === '=') {
        readPos += len
        refPos += len
      }
    }

    yield pos - readPos + refPos
  }
}
export function getModificationPositions(
  mm: string,
  fseq: string,
  fstrand: number,
) {
  const seq = fstrand === -1 ? revcom(fseq) : fseq
  const mods = mm.split(';').filter(mod => !!mod)
  const result = []
  for (let i = 0; i < mods.length; i++) {
    const mod = mods[i]
    const [basemod, ...skips] = mod.split(',')

    // regexes based on parse_mm.pl from hts-specs
    const matches = basemod.match(/([A-Z])([-+])([^,.?]+)([.?])?/)
    if (!matches) {
      throw new Error('bad format for MM tag')
    }
    const [, base, strand, typestr] = matches

    // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so
    // split, and they can also be chemical codes (ChEBI) e.g. C+16061
    const types = typestr.split(/(\d+|.)/).filter(f => !!f)

    if (strand === '-') {
      console.warn('unsupported negative strand modifications')
      // make sure to return a somewhat matching type even in this case
      return { type: 'unsupported', positions: [] }
    }

    // this logic also based on parse_mm.pl from hts-specs is that in the
    // sequence of the read, if we have a modification type e.g. C+m;2 and a
    // sequence ACGTACGTAC we skip the two instances of C and go to the last
    // C
    for (let j = 0; j < types.length; j++) {
      const type = types[j]
      let i = 0
      let positions = []
      for (let k = 0; k < skips.length; k++) {
        let delta = +skips[k]
        do {
          if (base === 'N' || base === seq[i]) {
            delta--
          }
          i++
        } while (delta >= 0 && i < seq.length)
        if (i >= seq.length) console.log('ran out of sequence')
        const temp = i - 1
        positions.push(fstrand === -1 ? seq.length - 1 - temp : temp)
      }
      if (fstrand === -1) {
        positions.sort((a, b) => a - b)
      }
      result.push({
        type,
        positions,
      })
    }
  }
  return result
}

export function getModificationTypes(mm: string) {
  const mods = mm.split(';')
  return mods
    .filter(mod => !!mod)
    .map(mod => {
      const [basemod] = mod.split(',')

      const matches = basemod.match(/([A-Z])([-+])([^,]+)/)
      if (!matches) {
        throw new Error('bad format for MM tag')
      }
      const [, , , typestr] = matches

      // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so
      // split, and they can also be chemical codes (ChEBI) e.g. C+16061
      return typestr.split(/(\d+|.)/).filter(f => !!f)
    })
    .flat()
}
