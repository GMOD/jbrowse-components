// CIGAR operation indices from BAM spec (used in packed Uint32Array format: len<<4|op)
export const CIGAR_M = 0
export const CIGAR_I = 1
export const CIGAR_D = 2
export const CIGAR_N = 3
export const CIGAR_S = 4
export const CIGAR_H = 5
export const CIGAR_P = 6
export const CIGAR_EQ = 7
export const CIGAR_X = 8

// Bitmask for CIGAR operation categories (use with: (1 << op) & MASK)
// Alignment match ops (M=0, ==7) — may contain mismatches, need MD tag
export const CIGAR_M_EQ_MASK = 0b10000001 // (1<<0)|(1<<7) = 129
