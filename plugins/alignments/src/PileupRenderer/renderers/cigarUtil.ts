import { parseCigar2 } from '../../MismatchParser'

// CIGAR operation indices (from BAM spec) - used in packed Uint32Array format
export const CIGAR_M = 0
export const CIGAR_I = 1
export const CIGAR_D = 2
export const CIGAR_N = 3
export const CIGAR_S = 4
export const CIGAR_H = 5
export const CIGAR_P = 6
export const CIGAR_EQ = 7
export const CIGAR_X = 8

// BAM 4-bit encoded sequence lookup table
export const SEQRET = '=ACMGRSVTWYHKDBN'

// Pre-computed char lookup for ASCII codes (avoids String.fromCharCode in hot loops)
export const CHAR_FROM_CODE: string[] = Array.from({ length: 128 }, (_, i) =>
  String.fromCharCode(i),
)

// Helper to ensure we have Uint32Array (packed format)
export function getCigarOps(cigar: Uint32Array | string): Uint32Array {
  return typeof cigar === 'string' ? parseCigar2(cigar) : cigar
}
