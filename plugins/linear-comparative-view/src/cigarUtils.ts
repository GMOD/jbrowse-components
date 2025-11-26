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

const cigarCharToCode: Record<string, number> = {
  M: CIGAR_M,
  I: CIGAR_I,
  D: CIGAR_D,
  N: CIGAR_N,
  S: CIGAR_S,
  H: CIGAR_H,
  P: CIGAR_P,
  '=': CIGAR_EQ,
  X: CIGAR_X,
}

export const cigarCodeToChar = ['M', 'I', 'D', 'N', 'S', 'H', 'P', '=', 'X']

// Parse string[] cigar (alternating len/op) into number[] with packed values
// Each value is (len << 4) | op, matching BAM CIGAR encoding
export function parseNumericCigar(cigar: string[]) {
  const result: number[] = []
  for (let i = 0; i < cigar.length; i += 2) {
    const len = +cigar[i]! | 0
    const op = cigarCharToCode[cigar[i + 1]!] ?? 0
    result.push((len << 4) | op)
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
