import { parseCigar2 } from '../../MismatchParser'

// CIGAR operation indices (from BAM spec) - used in packed Uint32Array format
export const CIGAR_M_IDX = 0
export const CIGAR_I_IDX = 1
export const CIGAR_D_IDX = 2
export const CIGAR_N_IDX = 3
export const CIGAR_S_IDX = 4
export const CIGAR_H_IDX = 5
export const CIGAR_P_IDX = 6
export const CIGAR_EQ_IDX = 7
export const CIGAR_X_IDX = 8

// Helper to ensure we have Uint32Array (packed format)
export function getCigarOps(cigar: Uint32Array | string): Uint32Array {
  return typeof cigar === 'string' ? parseCigar2(cigar) : cigar
}
