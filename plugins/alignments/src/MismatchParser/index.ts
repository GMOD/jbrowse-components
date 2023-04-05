import { revcom, Feature } from '@jbrowse/core/util'

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
const modificationRegex = new RegExp(/([A-Z])([-+])([^,.?]+)([.?])?/)
const cigarRegex = new RegExp(/([MIDNSHPX=])/)
const startClip = new RegExp(/(\d+)[SH]$/)
const endClip = new RegExp(/^(\d+)([SH])/)

export function parseCigar(cigar = '') {
  return cigar.split(cigarRegex).slice(0, -1)
}

export function cigarToMismatches(
  ops: string[],
  seq?: string,
  ref?: string,
  qual?: Buffer,
) {
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
              altbase: ref[roffset + j],
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
      const r = seq?.slice(soffset, soffset + len) || []
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
) {
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
        curr.qual = qual?.[s]
        curr.altbase = token
        nextRecord()
      }
    }
  }
  return mismatchRecords
}

export function getMismatches(
  cigar: string,
  md?: string,
  seq?: string,
  ref?: string,
  qual?: Buffer,
) {
  let mismatches: Mismatch[] = []
  const ops = parseCigar(cigar)

  // parse the CIGAR tag if it has one
  if (cigar) {
    mismatches = mismatches.concat(cigarToMismatches(ops, seq, ref, qual))
  }

  // now let's look for CRAM or MD mismatches
  if (md && seq) {
    mismatches = mismatches.concat(
      mdToMismatches(md, ops, mismatches, seq, qual),
    )
  }

  return mismatches
}
// get relative reference sequence positions for positions given relative to
// the read sequence
export function* getNextRefPos(cigarOps: string[], positions: number[]) {
  let readPos = 0
  let refPos = 0
  let currPos = 0

  for (let i = 0; i < cigarOps.length && currPos < positions.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op === 'S' || op === 'I') {
      for (let i = 0; i < len && currPos < positions.length; i++) {
        if (positions[currPos] === readPos + i) {
          currPos++
        }
      }
      readPos += len
    } else if (op === 'D' || op === 'N') {
      refPos += len
    } else if (op === 'M' || op === 'X' || op === '=') {
      for (let i = 0; i < len && currPos < positions.length; i++) {
        if (positions[currPos] === readPos + i) {
          yield refPos + i
          currPos++
        }
      }
      readPos += len
      refPos += len
    }
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
    const matches = basemod.match(modificationRegex)
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
      result.push({ type: 'unsupported', positions: [] as number[] })
    }

    // this logic also based on parse_mm.pl from hts-specs is that in the
    // sequence of the read, if we have a modification type e.g. C+m;2 and a
    // sequence ACGTACGTAC we skip the two instances of C and go to the last
    // C
    for (let j = 0; j < types.length; j++) {
      const type = types[j]
      let i = 0
      const positions = []
      for (let k = 0; k < skips.length; k++) {
        let delta = +skips[k]
        do {
          if (base === 'N' || base === seq[i]) {
            delta--
          }
          i++
        } while (delta >= 0 && i < seq.length)

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
  return mm
    .split(';')
    .filter(mod => !!mod)
    .flatMap(mod => {
      const [basemod] = mod.split(',')

      const matches = basemod.match(modificationRegex)
      if (!matches) {
        throw new Error(`bad format for MM tag: ${mm}`)
      }
      const typestr = matches[3]

      // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so
      // split, and they can also be chemical codes (ChEBI) e.g. C+16061
      return typestr.split(/(\d+|.)/).filter(f => !!f)
    })
}

export function getOrientedCigar(flip: boolean, cigar: string[]) {
  if (flip) {
    const ret = []
    for (let i = 0; i < cigar.length; i += 2) {
      const len = cigar[i]
      let op = cigar[i + 1]
      if (op === 'D') {
        op = 'I'
      } else if (op === 'I') {
        op = 'D'
      }
      ret.push(len, op)
    }
    return ret
  } else {
    return cigar
  }
}

export function getOrientedMismatches(flip: boolean, cigar: string) {
  const p = parseCigar(cigar)
  return cigarToMismatches(flip ? getOrientedCigar(flip, p) : p)
}

export function getLengthOnRef(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let lengthOnRef = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'I') {
      lengthOnRef += len
    }
  }
  return lengthOnRef
}

export function getLength(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'D' && op !== 'N') {
      length += len
    }
  }
  return length
}

export function getLengthSansClipping(cigar: string) {
  const cigarOps = parseCigar(cigar)
  let length = 0
  for (let i = 0; i < cigarOps.length; i += 2) {
    const len = +cigarOps[i]
    const op = cigarOps[i + 1]
    if (op !== 'H' && op !== 'S' && op !== 'D' && op !== 'N') {
      length += len
    }
  }
  return length
}

export function getClip(cigar: string, strand: number) {
  return strand === -1
    ? +(cigar.match(startClip) || [])[1] || 0
    : +(cigar.match(endClip) || [])[1] || 0
}

export function getTag(f: Feature, tag: string) {
  const tags = f.get('tags')
  return tags ? tags[tag] : f.get(tag)
}

// produces a list of "feature-like" object from parsing supplementary
// alignments in the SA tag
//
// @param normalize - used specifically in the linear-read-vs-ref context, it
// flips features around relative to the original feature. other contexts of
// usage can keep this false
export function featurizeSA(
  SA: string | undefined,
  id: string,
  strand: number,
  readName: string,
  normalize?: boolean,
) {
  return (
    SA?.split(';')
      .filter(aln => !!aln)
      .map((aln, index) => {
        const [saRef, saStart, saStrand, saCigar] = aln.split(',')
        const saLengthOnRef = getLengthOnRef(saCigar)
        const saLength = getLength(saCigar)
        const saLengthSansClipping = getLengthSansClipping(saCigar)
        const saStrandNormalized = saStrand === '-' ? -1 : 1
        const saClipPos = getClip(
          saCigar,
          (normalize ? strand : 1) * saStrandNormalized,
        )
        const saRealStart = +saStart - 1
        return {
          refName: saRef,
          start: saRealStart,
          end: saRealStart + saLengthOnRef,
          seqLength: saLength,
          clipPos: saClipPos,
          CIGAR: saCigar,
          strand: (normalize ? strand : 1) * saStrandNormalized,
          uniqueId: `${id}_SA${index}`,
          mate: {
            start: saClipPos,
            end: saClipPos + saLengthSansClipping,
            refName: readName,
          },
        }
      }) || []
  )
}
