/**
 * SAM flag bit constants for alignment records.
 * See SAM specification: https://samtools.github.io/hts-specs/SAMv1.pdf
 */

/** Read is paired in sequencing */
export const SAM_FLAG_PAIRED = 1

/** Read is mapped in a proper pair */
export const SAM_FLAG_PROPER_PAIR = 2

/** Read is unmapped */
export const SAM_FLAG_UNMAPPED = 4

/** Mate is unmapped */
export const SAM_FLAG_MATE_UNMAPPED = 8

/** Read is on reverse strand */
export const SAM_FLAG_REVERSE = 16

/** Mate is on reverse strand */
export const SAM_FLAG_MATE_REVERSE = 32

/** Read is first in pair */
export const SAM_FLAG_FIRST_IN_PAIR = 64

/** Read is second in pair */
export const SAM_FLAG_SECOND_IN_PAIR = 128

/** Secondary alignment (not primary) */
export const SAM_FLAG_SECONDARY = 256

/** Read fails platform/vendor quality checks */
export const SAM_FLAG_FAILS_QC = 512

/** Read is PCR or optical duplicate */
export const SAM_FLAG_DUPLICATE = 1024

/** Supplementary alignment (chimeric/split read) */
export const SAM_FLAG_SUPPLEMENTARY = 2048
