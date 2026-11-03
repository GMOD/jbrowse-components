import { parseModHeader } from './consts.ts'
import { isSingleModType } from './getModTypes.ts'

export interface ModWithPositions {
  type: string
  base: string
  strand: string
  // true when the MM tag used the '?' flag: the modification status of bases
  // not listed in the tag is unknown (vs '.'/absent = assumed unmodified).
  unknownSkip: boolean
  // **Shared by identity wherever two entries are called at the same
  // positions**, which happens two ways: across the types of one MM group (a
  // combined code like 'C+mh' calls both types at the same positions), and
  // across separate groups that count the same base with the same deltas
  // (dorado's 'C+h?;C+m?'). Either way it yields one array and several entries
  // pointing at it — which is what lets a CIGAR walk recognize that they are the
  // same walk (`forEachMaxProbMod` does). Treat as read-only: mutating one
  // entry's positions mutates its siblings'.
  positions: number[]
  // Index into the flat ML probabilities array for this type's first KEPT
  // MM-order position, and the stride to the next one. For a combined code
  // like 'C+mh' the ML values are interleaved per position (m,h,m,h,...), so
  // 'm' has probStart 0 / probStride 2 and 'h' has probStart 1 / probStride 2.
  // Single-type codes are contiguous: probStride 1.
  probStart: number
  probStride: number
}

const COMPLEMENT_CODE: Record<number, number> = {
  65: 84, // A->T
  84: 65, // T->A
  67: 71, // C->G
  71: 67, // G->C
  78: 78, // N->N
}

const COMMA = 44

const encoder = new TextEncoder()
const scratch = new Uint8Array(1 << 16)
const scratchWords = new Uint32Array(
  scratch.buffer,
  scratch.byteOffset,
  scratch.byteLength / 4,
)

// Occurrences of `code` in text[start, end), four characters per step over the
// text's bytes: a byte of `word ^ pattern` is zero exactly where the character
// matches, and the SWAR zero-byte test finds all four at once.
function countCode(text: string, code: number, start: number, end: number) {
  const pattern = Math.imul(code, 0x01010101)
  let n = 0
  for (let from = start; from < end; from += scratch.length) {
    const to = Math.min(end, from + scratch.length)
    const len = to - from
    const { read, written } = encoder.encodeInto(
      text.substring(from, to),
      scratch,
    )
    if (read !== len || written !== len) {
      for (let i = from; i < to; i++) {
        n += +(text.charCodeAt(i) === code)
      }
      continue
    }
    const nWords = len >> 2
    for (let i = 0; i < nWords; i++) {
      const x = scratchWords[i]! ^ pattern
      const zero = ~(((x & 0x7f7f7f7f) + 0x7f7f7f7f) | x | 0x7f7f7f7f)
      n += Math.imul(zero >>> 7, 0x01010101) >>> 24
    }
    for (let i = nWords << 2; i < len; i++) {
      n += +(scratch[i] === code)
    }
  }
  return n
}

interface Walked {
  key: string
  deltas: string
  positions: number[]
  skipped: number
  nPositions: number
}

// One group's calls inside [windowStart, windowEnd), ascending, and how many
// calls came before them in MM order. `deltas` is the group after its header,
// `,2,2,1`.
//
// An MM tag may declare more calls of a base than the read has left. When that
// happens the walk has nowhere to put them, and every emitted value still has
// to be a valid index into the read — `getMethBins` indexes the sequence with
// these, and the CIGAR walk requires them ascending, so a position outside the
// read is read as a real one somewhere wrong rather than dropped. So the
// exhausted case clamps to the nearest valid index and stays there, which on an
// empty read is 0 for every call.
function walkGroup(
  deltas: string,
  nPositions: number,
  base: string,
  fseq: string,
  isRev: boolean,
  windowStart: number,
  windowEnd: number,
) {
  const seqLength = fseq.length
  const positions: number[] = []
  if (seqLength === 0) {
    for (let i = 0; i < nPositions; i++) {
      positions.push(0)
    }
    return { positions, skipped: 0 }
  }
  if (windowStart >= windowEnd || nPositions === 0) {
    return { positions, skipped: 0 }
  }
  const isN = base === 'N'
  const baseCode = base.charCodeAt(0)
  // Reverse reads are walked from the back of fseq, matching the complement,
  // rather than reverse-complementing the read.
  const code = isRev ? (COMPLEMENT_CODE[baseCode] ?? baseCode) : baseCode

  // `+field` for each delta in turn, read in place rather than split out: the
  // digits are summed as they are passed, and a field holding anything else
  // (a sign, a space, a fraction) goes to `+` itself, so a malformed tag reads
  // as it always has. Against `split(',')` on this same windowed walk it
  // measured 1.24x at a 1 kb view and 1.03x over whole reads
  // (`benches/modWindow.bench.ts`); `mmParseShape.bench.ts` had declined it
  // at 1.06x when every read was walked end to end.
  const deltasLength = deltas.length
  let cursor = 0
  const next = () => {
    const from = cursor + 1
    let to = from
    let value = 0
    let digits = true
    for (; to < deltasLength; to++) {
      const d = deltas.charCodeAt(to) - 48
      if (d === COMMA - 48) {
        break
      }
      if (d < 0 || d > 9) {
        digits = false
      }
      value = value * 10 + d
    }
    cursor = to
    return digits && to - from < 16 ? value : +deltas.slice(from, to)
  }

  // The calls on the 5' side of the window are passed over by counting their
  // base there once and subtracting whole deltas from the count. `carry` is
  // what is left: occurrences the first kept call has already used up. A NaN
  // delta fails the test and is handed to the walk, which places it as it
  // always has.
  const tallyStart = isRev ? windowEnd : 0
  const tallyEnd = isRev ? seqLength : windowStart
  let carry = isN
    ? tallyEnd - tallyStart
    : countCode(fseq, code, tallyStart, tallyEnd)
  let first = 1
  let delta = next()
  while (delta + 1 <= carry && first < nPositions) {
    carry -= delta + 1
    first++
    delta = next()
  }
  if (delta + 1 <= carry) {
    return { positions, skipped: nPositions }
  }

  if (isRev) {
    let currPos = seqLength - windowEnd
    for (let i = first; i <= nPositions; i++) {
      if (i > first) {
        delta = next()
      }
      let at = 0
      if (currPos < seqLength) {
        let remaining = delta - carry
        carry = 0
        do {
          if (isN || fseq.charCodeAt(seqLength - 1 - currPos) === code) {
            remaining--
          }
          currPos++
        } while (remaining >= 0 && currPos < seqLength)
        at = seqLength - currPos
      }
      if (at < windowStart) {
        break
      }
      positions.push(at)
    }
    positions.reverse()
  } else {
    // **Forward jumps, reverse steps, and the asymmetry is measured rather
    // than assumed.** `indexOf` for a single character is a native scan, so
    // finding the (delta+1)-th occurrence is delta+1 searches instead of one
    // step per base — 1.560x on the sparse fixture and 1.247x on the dense
    // one, parse phase, in `benches/mmDeltaJump.bench.ts`. `lastIndexOf` is
    // NOT the mirror image: the same change on reverse reads measures
    // **0.786x**.
    const endClamp = seqLength - 1
    let currPos = windowStart
    for (let i = first; i <= nPositions; i++) {
      if (i > first) {
        delta = next()
      }
      const remaining = delta - carry
      carry = 0
      let at = -1
      if (isN) {
        // 'N' matches every base, so the (delta+1)-th is delta ahead and
        // there is nothing to search for.
        at = currPos + remaining
        if (at >= seqLength) {
          at = -1
        }
      } else {
        for (let k = 0; k <= remaining; k++) {
          at = fseq.indexOf(base, currPos)
          if (at < 0) {
            break
          }
          currPos = at + 1
        }
      }
      if (at < 0) {
        currPos = seqLength
        at = endClamp
      } else {
        currPos = at + 1
      }
      if (at >= windowEnd) {
        break
      }
      positions.push(at)
    }
  }
  return { positions, skipped: first - 1 }
}

/**
 * #api
 * Parse MM tag to extract modification positions on the read sequence.
 *
 * Only the calls placed inside `[readStart, readEnd)` are kept, and each
 * entry's `probStart` moves past the calls dropped ahead of them, so ML
 * indexing is unchanged. The deltas count from the read's 5' end, which is the
 * END of `fseq` on a reverse read: the bases between that end and the window
 * are still counted, but only as a tally, and nothing past the far side of the
 * window is walked.
 *
 * @param mm - MM tag string (e.g., "C+m,2,2,1;A+a,0,3")
 * @param fseq - Read sequence
 * @param fstrand - Read strand (-1, 0, or 1)
 * @param readStart - First read offset to keep
 * @param readEnd - Read offset past the last one to keep
 * @returns Array of modification objects with positions
 */
export function getModPositions(
  mm: string,
  fseq: string,
  fstrand: number,
  readStart = 0,
  readEnd = fseq.length,
) {
  const isRev = fstrand === -1
  const windowStart = Math.max(0, readStart)
  const windowEnd = Math.min(fseq.length, readEnd)
  const result: ModWithPositions[] = []
  // Running offset into the flat ML probabilities array. Each group consumes
  // (numPositions * numTypes) values, interleaved per position.
  let mlBase = 0

  // Groups already walked, so a later group calling the same positions can reuse
  // the array instead of walking the sequence again for it. Dorado's 5mCG_5hmCG
  // model emits `C+h?;C+m?` — two groups, one canonical base, identical delta
  // lists — so on real ONT output this drops one of every three sequence walks.
  //
  // The key is what the walk READS: the canonical base and the delta list
  // (`fseq`, `fstrand` and the window are per read, not per group). It also
  // carries the MM strand, which the walk does not currently read —
  // deliberately stronger than needed, so the test cannot go quietly wrong if
  // the walk ever becomes strand-aware.
  //
  // A list rather than a Map: a read carries one to four groups, so a linear
  // scan of char compares beats hashing a multi-kilobyte delta string, and it
  // is allocated on the first walk so a single-group read builds none.
  // `benches/sameBaseMerge.bench.ts` prices the whole test at inside the control
  // on every fixture where it cannot fire, including one where every compare is
  // forced to run to its final byte and then fail. A group that matches is not
  // even split.
  let seen: Walked[] | undefined

  for (const mod of mm.split(';')) {
    if (mod === '') {
      continue
    }
    const comma = mod.indexOf(',')
    const basemod = comma < 0 ? mod : mod.slice(0, comma)
    const {
      base,
      strand,
      typestr,
      mod: skipFlag,
    } = parseModHeader(basemod, mod)
    const unknownSkip = skipFlag === '?'

    // typestr can be multi-char lowercase e.g. 'mh' (5mC + 5hmC at same
    // positions) or a ChEBI code e.g. '16061'. The rule is `isSingleModType`,
    // shared with `getModTypes` so the two cannot disagree about what a tag
    // declares.
    const isSingleType = isSingleModType(typestr)
    const nTypes = isSingleType ? 1 : typestr.length

    // ONE walk per GROUP, not per type. Every type in a combined code is called
    // at the same positions — only probStart differs — so the walk and the
    // array it fills are shared, and the entries pushed after it point at the
    // same array. `C+mh` used to walk the read sequence twice and allocate two
    // identical arrays; `benches/modCombinedCode.bench.ts` (in the alignments
    // plugin, where the fixture lives) prices that at **2.07x** on a synthesized
    // `C+mh`, and at **1.16x** even on a single-type tag, where nothing is
    // deduplicated and the win is the per-group closure this loop replaced.
    //
    // this logic based on parse_mm.pl from hts-specs
    //
    // Everything after the header — `,2,2,1`. V8 slices a long string in O(1),
    // and the compare rejects on length before it reads a byte.
    const deltas = mod.slice(basemod.length)
    const key = base + strand

    let walked = seen?.find(w => w.key === key && w.deltas === deltas)
    if (walked === undefined) {
      const nPositions = countCode(deltas, COMMA, 0, deltas.length)
      walked = {
        key,
        deltas,
        nPositions,
        ...walkGroup(
          deltas,
          nPositions,
          base,
          fseq,
          isRev,
          windowStart,
          windowEnd,
        ),
      }
      if (seen === undefined) {
        seen = [walked]
      } else {
        seen.push(walked)
      }
    }
    const { positions, skipped, nPositions } = walked

    const probStart = mlBase + skipped * nTypes
    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        strand,
        unknownSkip,
        positions,
        probStart,
        probStride: 1,
      })
    } else {
      // Multi-char lowercase: each character is a separate type
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
          strand,
          unknownSkip,
          positions,
          probStart: probStart + j,
          probStride: nTypes,
        })
      }
    }
    // Unaffected by the reuse above. Two separate groups' ML values are
    // consecutive, not interleaved, so each group consumes its own
    // nPositions * nTypes whether or not it walked for them — which is why
    // sharing the array leaves probStart/probStride alone.
    mlBase += nPositions * nTypes
  }

  return result
}
