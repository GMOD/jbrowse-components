// ASCII byte codes used by MAF parsing/rendering for Uint8Array operations
export const DASH = 45 // '-'
export const SPACE = 32 // ' '
// XOR with this bit toggles ASCII letter case; AND ~LOWER_BIT uppercases
export const LOWER_BIT = 0x20
// Uppercase 'N'. Compared against `byte & ~LOWER_BIT`, so it matches both cases.
// An `N` reference base is unclassifiable — it can be neither matched nor
// mismatched — which is why the coverage/identity walks all have to know it.
export const N_UPPER = 78
