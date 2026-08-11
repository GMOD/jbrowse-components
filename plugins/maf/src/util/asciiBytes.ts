// ASCII byte codes used by MAF parsing/rendering for Uint8Array operations
export const DASH = 45 // '-'
export const SPACE = 32 // ' '
// XOR with this bit toggles ASCII letter case; AND ~LOWER_BIT uppercases
export const LOWER_BIT = 0x20
// Uppercase 'N'. Compared against `byte & ~LOWER_BIT`, so it matches both cases.
// An `N` reference base is unclassifiable — it can be neither matched nor
// mismatched — which is why the coverage/identity walks all have to know it.
export const N_UPPER = 78

/**
 * No base is present at this alignment column for this row: a gap (`-`) or the
 * padding (` `) a row shorter than the block is filled with. The two always
 * travel together — every reader of one reads the other — and spelled out at
 * the call site they are four comparisons that have to be scanned to be
 * believed, which in the codon path meant six.
 *
 * The per-byte worker walks (`computeMafCoverage`, `resolveCellColor`) keep the
 * comparison inline on purpose: those run once per cell per row per block, and
 * they are the loops MAF's render cost is measured in. Everything that asks the
 * question once per codon or once per hover should use this.
 */
export function isNoBaseByte(byte: number) {
  return byte === DASH || byte === SPACE
}
