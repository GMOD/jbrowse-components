import { parseModHeader } from './consts.ts'

export interface ModWithPositions {
  type: string
  base: string
  strand: string
  // true when the MM tag used the '?' flag: the modification status of bases
  // not listed in the tag is unknown (vs '.'/absent = assumed unmodified).
  unknownSkip: boolean
  positions: number[]
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

    // typestr can be multi-char lowercase e.g. 'mh' (5mC + 5hmC at same positions)
    // or a ChEBI code e.g. '16061'. Non-lowercase or single-char = one type.
    const isSingleType = typestr.charCodeAt(0) < 97 || typestr.length === 1

    // this logic based on parse_mm.pl from hts-specs
    const processType = (type: string) => {
      const splitLength = split.length
      let currPos = 0

      // Avoid revcom(fseq) by reading fseq from the back and complementing the
      // expected char-code on reverse strand.
      const baseCode = base.charCodeAt(0)
      const targetCode = isRev
        ? (COMPLEMENT_CODE[baseCode] ?? baseCode)
        : baseCode
      const isN = base === 'N'

      // Pre-allocate and fill backwards on reverse strand to avoid a final reverse()
      const positions = isRev ? new Array(splitLength - 1) : []
      let writeIndex = isRev ? splitLength - 2 : 0

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

      result.push({
        type,
        base,
        strand,
        unknownSkip,
        positions,
      })
    }

    if (isSingleType) {
      processType(typestr)
    } else {
      // Multi-char lowercase: each character is a separate type
      for (let j = 0, len = typestr.length; j < len; j++) {
        processType(typestr[j]!)
      }
    }
  }

  return result
}
