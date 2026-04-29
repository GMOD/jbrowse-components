// Bitmask for CIGAR operation categories (use with: (1 << op) & MASK)
// Alignment match ops (M=0, ==7) — may contain mismatches, need MD tag
export const CIGAR_M_EQ_MASK = 0b10000001 // (1<<0)|(1<<7) = 129

// BAM 4-bit encoded sequence lookup table
export const SEQRET = '=ACMGRSVTWYHKDBN'

// Numeric decoder - returns char codes directly (lowercase for case-insensitive comparison)
// '=' = 61, 'a' = 97, 'c' = 99, 'm' = 109, 'g' = 103, 'r' = 114, 's' = 115, 'v' = 118,
// 't' = 116, 'w' = 119, 'y' = 121, 'h' = 104, 'k' = 107, 'd' = 100, 'b' = 98, 'n' = 110
export const SEQRET_NUMERIC_DECODER = new Uint8Array([
  61, 97, 99, 109, 103, 114, 115, 118, 116, 119, 121, 104, 107, 100, 98, 110,
])

// Pre-computed char lookup for ASCII codes (avoids String.fromCharCode in hot loops)
export const CHAR_FROM_CODE: string[] = Array.from({ length: 128 }, (_, i) =>
  String.fromCharCode(i),
)

export {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_P,
  CIGAR_S,
  CIGAR_X,
} from '@jbrowse/alignments-core'
