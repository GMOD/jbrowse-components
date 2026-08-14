import { parseModHeader } from './consts.ts'
import { isSingleModType } from './getModTypes.ts'

export interface ModWithPositions {
  type: string
  base: string
  strand: string
  // true when the MM tag used the '?' flag: the modification status of bases
  // not listed in the tag is unknown (vs '.'/absent = assumed unmodified).
  unknownSkip: boolean
  // **Shared by identity across the types of one MM group.** A combined code
  // like 'C+mh' calls both types at the same positions, so it yields one array
  // and two entries pointing at it — which is what lets a CIGAR walk recognize
  // that two entries are the same walk (`forEachMaxProbMod` does). Treat as
  // read-only: mutating one entry's positions mutates its siblings'.
  positions: number[]
  // Index into the flat ML probabilities array for this type's first
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

/**
 * #api
 * Parse MM tag to extract modification positions on the read sequence.
 *
 * @param mm - MM tag string (e.g., "C+m,2,2,1;A+a,0,3")
 * @param fseq - Read sequence
 * @param fstrand - Read strand (-1, 0, or 1)
 * @returns Array of modification objects with positions
 */
export function getModPositions(mm: string, fseq: string, fstrand: number) {
  const seqLength = fseq.length
  const isRev = fstrand === -1
  const mods = mm.split(';')
  const result: ModWithPositions[] = []
  // Running offset into the flat ML probabilities array. Each group consumes
  // (numPositions * numTypes) values, interleaved per position.
  let mlBase = 0

  for (const mod of mods) {
    if (mod === '') {
      continue
    }
    const split = mod.split(',')
    const basemod = split[0]!
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
    // at the same positions — only probStart differs — so the walk below and the
    // array it fills are shared, and the entries pushed after it point at the
    // same array. `C+mh` used to walk the read sequence twice and allocate two
    // identical arrays; `benches/modCombinedCode.bench.ts` (in the alignments
    // plugin, where the fixture lives) prices that at **2.07x** on a synthesized
    // `C+mh`, and at **1.16x** even on a single-type tag, where nothing is
    // deduplicated and the win is the per-group closure this loop replaced.
    //
    // this logic based on parse_mm.pl from hts-specs
    const splitLength = split.length
    const nPositions = splitLength - 1
    let currPos = 0

    // Avoid revcom(fseq) by reading fseq from the back and complementing the
    // expected char-code on reverse strand.
    const baseCode = base.charCodeAt(0)
    const targetCode = isRev
      ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
      : baseCode
    const isN = base === 'N'

    // Pre-allocate and fill backwards on reverse strand to avoid a final
    // reverse(). Forward stays a growing literal on purpose: filling
    // `new Array(n)` leaves holey elements, and this array is read in the CIGAR
    // walk's inner loop.
    const positions: number[] = isRev ? new Array(nPositions) : []
    let writeIndex = isRev ? nPositions - 1 : 0

    for (let i = 1; i < splitLength; i++) {
      let delta = +split[i]!
      do {
        const seqCode = isRev
          ? fseq.charCodeAt(seqLength - 1 - currPos)
          : fseq.charCodeAt(currPos)
        if (isN || seqCode === targetCode) {
          delta--
        }
        currPos++
      } while (delta >= 0 && currPos < seqLength)

      // currPos <= seqLength by loop invariant, so seqLength - currPos >= 0
      if (isRev) {
        positions[writeIndex--] = seqLength - currPos
      } else {
        positions[writeIndex++] = currPos - 1
      }
    }

    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        strand,
        unknownSkip,
        positions,
        probStart: mlBase,
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
          probStart: mlBase + j,
          probStride: nTypes,
        })
      }
    }
    mlBase += nPositions * nTypes
  }

  return result
}
