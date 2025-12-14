// Callback-based mismatch iterator - avoids creating intermediate array
// Iterates directly over packed BAM data (NUMERIC_CIGAR, NUMERIC_SEQ, NUMERIC_MD)

const CIGAR_M = 0
const CIGAR_I = 1
const CIGAR_D = 2
const CIGAR_N = 3
const CIGAR_S = 4
const CIGAR_H = 5
const CIGAR_EQ = 7
const CIGAR_X = 8

const SEQRET = '=ACMGRSVTWYHKDBN'

export const MISMATCH_TYPE = 0
export const INSERTION_TYPE = 1
export const DELETION_TYPE = 2
export const SKIP_TYPE = 3
export const SOFTCLIP_TYPE = 4
export const HARDCLIP_TYPE = 5

export type MismatchCallback = (
  type: number,
  start: number,
  length: number,
  base: string,
  qual: number,
  altbase: number,
  cliplen: number,
) => void

export function forEachMismatch(
  cigar: ArrayLike<number> | undefined,
  numericSeq: ArrayLike<number> | undefined,
  seqLength: number,
  md: ArrayLike<number> | undefined,
  qual: ArrayLike<number> | null | undefined,
  callback: MismatchCallback,
) {
  if (!cigar || !numericSeq) {
    return
  }

  const mdLength = md?.length ?? 0
  const hasQual = !!qual
  const hasMD = md && mdLength > 0

  let roffset = 0
  let soffset = 0
  let mdIdx = 0
  let mdMatchRemaining = 0

  // Parse initial MD match count
  if (hasMD) {
    while (mdIdx < mdLength) {
      const c = md[mdIdx]!
      if (c >= 48 && c <= 57) {
        mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
        mdIdx++
      } else {
        break
      }
    }
  }

  for (let i = 0, l = cigar.length; i < l; i++) {
    const packed = cigar[i]!
    const len = packed >> 4
    const op = packed & 0xf

    if (op === CIGAR_M || op === CIGAR_EQ) {
      if (hasMD) {
        let remaining = Math.min(len, seqLength - soffset)
        let localOffset = 0

        while (remaining > 0) {
          if (mdMatchRemaining >= remaining) {
            mdMatchRemaining -= remaining
            localOffset += remaining
            remaining = 0
          } else {
            localOffset += mdMatchRemaining
            remaining -= mdMatchRemaining
            mdMatchRemaining = 0

            if (mdIdx < mdLength && md[mdIdx]! >= 65 && md[mdIdx]! <= 90) {
              const seqIdx = soffset + localOffset
              const sb = numericSeq[seqIdx >> 1]!
              const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf

              callback(
                MISMATCH_TYPE,
                roffset + localOffset,
                1,
                SEQRET[nibble]!,
                hasQual ? qual[seqIdx]! : -1,
                md[mdIdx]!,
                0,
              )

              mdIdx++
              localOffset++
              remaining--
              mdMatchRemaining = 0
              while (mdIdx < mdLength) {
                const c = md[mdIdx]!
                if (c >= 48 && c <= 57) {
                  mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
                  mdIdx++
                } else {
                  break
                }
              }
            } else {
              break
            }
          }
        }
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_I) {
      // Build inserted bases string
      let insertedBases = ''
      for (let j = 0; j < len && soffset + j < seqLength; j++) {
        const seqIdx = soffset + j
        const sb = numericSeq[seqIdx >> 1]!
        const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf
        insertedBases += SEQRET[nibble]!
      }
      callback(INSERTION_TYPE, roffset, 0, insertedBases, -1, 0, len)
      soffset += len
    } else if (op === CIGAR_D) {
      callback(DELETION_TYPE, roffset, len, '*', -1, 0, 0)

      // Skip deletion in MD
      if (hasMD && mdIdx < mdLength && md[mdIdx]! === 94) {
        mdIdx++
        while (mdIdx < mdLength && md[mdIdx]! >= 65) {
          mdIdx++
        }
        mdMatchRemaining = 0
        while (mdIdx < mdLength) {
          const c = md[mdIdx]!
          if (c >= 48 && c <= 57) {
            mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
            mdIdx++
          } else {
            break
          }
        }
      }
      roffset += len
    } else if (op === CIGAR_N) {
      callback(SKIP_TYPE, roffset, len, 'N', -1, 0, 0)
      roffset += len
    } else if (op === CIGAR_X) {
      // X = mismatch (EQ/X CIGAR)
      for (let j = 0; j < len; j++) {
        const seqIdx = soffset + j
        const sb = numericSeq[seqIdx >> 1]!
        const nibble = (sb >> ((1 - (seqIdx & 1)) << 2)) & 0xf

        let altbaseCode = 0
        if (hasMD) {
          if (mdMatchRemaining === 0 && mdIdx < mdLength && md[mdIdx]! >= 65) {
            altbaseCode = md[mdIdx]!
            mdIdx++
            mdMatchRemaining = 0
            while (mdIdx < mdLength) {
              const c = md[mdIdx]!
              if (c >= 48 && c <= 57) {
                mdMatchRemaining = mdMatchRemaining * 10 + (c - 48)
                mdIdx++
              } else {
                break
              }
            }
          } else if (mdMatchRemaining > 0) {
            mdMatchRemaining--
          }
        }

        callback(
          MISMATCH_TYPE,
          roffset + j,
          1,
          SEQRET[nibble]!,
          hasQual ? qual[seqIdx]! : -1,
          altbaseCode,
          0,
        )
      }
      soffset += len
      roffset += len
    } else if (op === CIGAR_S) {
      callback(SOFTCLIP_TYPE, roffset, 1, `S${len}`, -1, 0, len)
      soffset += len
    } else if (op === CIGAR_H) {
      callback(HARDCLIP_TYPE, roffset, 1, `H${len}`, -1, 0, len)
    }
  }
}
