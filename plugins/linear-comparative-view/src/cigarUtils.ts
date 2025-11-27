// Numeric CIGAR operation codes (matches BAM spec)
export const CIGAR_M = 0
export const CIGAR_I = 1
export const CIGAR_D = 2
export const CIGAR_N = 3
export const CIGAR_S = 4
export const CIGAR_H = 5
export const CIGAR_P = 6
export const CIGAR_EQ = 7
export const CIGAR_X = 8

// Bitmasks for checking multiple ops: use ((1 << op) & MASK) !== 0
// M(0), =(7), X(8) - alignment match ops
export const CIGAR_MATCH_MASK = (1 << CIGAR_M) | (1 << CIGAR_EQ) | (1 << CIGAR_X) // 385
// D(2), N(3) - deletion ops (consume reference only)
export const CIGAR_DEL_MASK = (1 << CIGAR_D) | (1 << CIGAR_N) // 12
// I(1), D(2), N(3) - insertion/deletion ops
export const CIGAR_INDEL_MASK = (1 << CIGAR_I) | (1 << CIGAR_D) | (1 << CIGAR_N) // 14

// Lookup table for CIGAR op char codes (ASCII) to numeric codes
// Using array indexed by char code for fast lookup
const cigarCharCodeToOp: number[] = []
cigarCharCodeToOp[77] = CIGAR_M // 'M'
cigarCharCodeToOp[73] = CIGAR_I // 'I'
cigarCharCodeToOp[68] = CIGAR_D // 'D'
cigarCharCodeToOp[78] = CIGAR_N // 'N'
cigarCharCodeToOp[83] = CIGAR_S // 'S'
cigarCharCodeToOp[72] = CIGAR_H // 'H'
cigarCharCodeToOp[80] = CIGAR_P // 'P'
cigarCharCodeToOp[61] = CIGAR_EQ // '='
cigarCharCodeToOp[88] = CIGAR_X // 'X'

export const cigarCodeToChar = ['M', 'I', 'D', 'N', 'S', 'H', 'P', '=', 'X']

// Parse CIGAR string directly to packed number[] format
// Each value is (len << 4) | op
export function parseCigar(cigar?: string) {
  if (!cigar) {
    return []
  }
  const result: number[] = []
  let len = 0
  for (let i = 0; i < cigar.length; i++) {
    const c = cigar.charCodeAt(i)
    // ASCII digits are 48-57
    if (c >= 48 && c <= 57) {
      len = len * 10 + c - 48
    } else {
      const op = cigarCharCodeToOp[c] ?? 0
      result.push((len << 4) | op)
      len = 0
    }
  }
  return result
}

// Extract length from packed CIGAR value
export function cigarLen(packed: number) {
  return packed >> 4
}

// Extract op from packed CIGAR value
export function cigarOp(packed: number) {
  return packed & 0xf
}
