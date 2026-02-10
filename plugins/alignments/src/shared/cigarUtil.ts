import { parseCigar2 } from '../MismatchParser/index.ts'

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

// Bitmasks for CIGAR operation categories (use with: (1 << op) & MASK)
// Alignment match ops (M=0, ==7) - may contain mismatches, need MD tag
export const CIGAR_M_EQ_MASK = 0b10000001 // (1<<0)|(1<<7) = 129
// Match/mismatch ops that consume both ref and seq (M=0, ==7, X=8)
export const CIGAR_MATCH_MASK = 0b110000001 // (1<<0)|(1<<7)|(1<<8) = 385
// Seq-only ops (S=4, I=1)
export const CIGAR_SEQ_ONLY_MASK = 0b10010 // (1<<1)|(1<<4) = 18
// Ref-skip ops (D=2, N=3)
export const CIGAR_REF_SKIP_MASK = 0b1100 // (1<<2)|(1<<3) = 12
// Ref-consuming ops (M=0, D=2, ==7, X=8)
export const CIGAR_REF_CONSUMING_MASK = 0b110000101 // (1<<0)|(1<<2)|(1<<7)|(1<<8) = 389

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

// Helper to ensure we have Uint32Array (packed format)
export function getCigarOps(
  cigar: Uint32Array | string | undefined,
): ArrayLike<number> {
  return typeof cigar === 'string' ? parseCigar2(cigar) : cigar || []
}
