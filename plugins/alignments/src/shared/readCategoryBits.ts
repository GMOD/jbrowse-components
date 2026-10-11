import {
  CIGAR_HAS_SKIP,
  CIGAR_HAS_SV_DELETION,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

/**
 * Three yes-or-no questions about a whole read, which the extract answers once
 * into `readCategoryBits` for the sort. The filter and the facet ask the same
 * questions of the record in the worker: `cigarCategoryBits` for the CIGAR's
 * two (`@jbrowse/cigar-utils`' `numericCigarCategoryBits` and
 * `cigarStringCategoryBits`), and {@link splitBit} for the split. The CIGAR
 * walk that extracts the drawn gaps stops at the region, so asking it would
 * answer for the part of a read in view.
 */
export const READ_SPLIT = 1
export const READ_SPLICED = CIGAR_HAS_SKIP
export const READ_SV_DELETION = CIGAR_HAS_SV_DELETION

/**
 * Whether a record is a piece of a chimeric alignment: it carries an SA tag,
 * which the aligner writes on every piece, the primary included, or the
 * supplementary flag, the backstop for a piece whose SA the source dropped.
 * `sa` is the tag as the caller read it, `''` for none.
 */
export function splitBit(flags: number, sa: string) {
  return (flags & SAM_FLAG_SUPPLEMENTARY) !== 0 || sa !== '' ? READ_SPLIT : 0
}
