import {
  CIGAR_HAS_SKIP,
  CIGAR_HAS_SV_DELETION,
  CIGAR_HAS_SV_INSERTION,
  SAM_FLAG_PAIRED,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SUPPLEMENTARY,
} from '@jbrowse/cigar-utils'

import { isConcordantPairRead } from './orientation.ts'

/**
 * Yes-or-no questions about a whole read, which the alignments extract answers
 * once into `readCategoryBits` for the sort and the breakpoint split view. The
 * read filter asks the same questions of the record in the worker, through
 * {@link readCategoryBits}. The CIGAR's three come from `cigarCategoryBits`
 * (`@jbrowse/cigar-utils`), over the whole record: the walk that extracts the
 * drawn gaps stops at the region, so asking it would answer for the part of a
 * read in view.
 */
export const READ_SPLIT = 1
export const READ_SPLICED = CIGAR_HAS_SKIP
export const READ_SV_DELETION = CIGAR_HAS_SV_DELETION
export const READ_SV_INSERTION = CIGAR_HAS_SV_INSERTION
export const READ_DISCORDANT = 16

/**
 * The record's mate is at MAPQ 0, where its MQ tag says. Kept beside the tier
 * because the tier is the read's strongest evidence: a split read keeps tier 3
 * whatever its mate's placement, and an interchromosomal mate link still needs
 * the mate placed.
 */
export const READ_MATE_UNPLACED = 128

/** An indel of `SV_INDEL_MIN_BP` or more. */
export const READ_SV_INDEL = READ_SV_DELETION | READ_SV_INSERTION

const SV_TIER_SHIFT = 5

/**
 * Whether a record is a piece of a chimeric alignment: it carries an SA tag,
 * which the aligner writes on every piece, the primary included, or the
 * supplementary flag, the backstop for a piece whose SA the source dropped.
 * `sa` is the tag as the caller read it, `''` for none.
 */
export function splitBit(flags: number, sa: string) {
  return (flags & SAM_FLAG_SUPPLEMENTARY) !== 0 || sa !== '' ? READ_SPLIT : 0
}

const NOT_PRIMARY = SAM_FLAG_SECONDARY | SAM_FLAG_SUPPLEMENTARY

/**
 * A paired primary record that fails {@link isConcordantPairRead}: its mate is
 * unmapped or on another chromosome, the pair faces the wrong way, or the
 * aligner did not flag it proper. A flagless synteny block is unpaired and
 * never discordant.
 */
export function discordantBit(flags: number, pairOrientationNum: number) {
  const pairedPrimary =
    (flags & (SAM_FLAG_PAIRED | NOT_PRIMARY)) === SAM_FLAG_PAIRED
  return pairedPrimary && !isConcordantPairRead(flags, pairOrientationNum)
    ? READ_DISCORDANT
    : 0
}

/** Every category bit of one record. */
export function readCategoryBits(
  flags: number,
  sa: string,
  cigarBits: number,
  pairOrientationNum: number,
) {
  return (
    splitBit(flags, sa) | cigarBits | discordantBit(flags, pairOrientationNum)
  )
}

// MAPQ 0 says the aligner placed the record as well somewhere else. 255 is SAM's
// "unavailable", which a synteny block and some aligners write, and counts as
// placed: the rule cannot tell.
function isPlaced(mapq: number) {
  return mapq !== 0
}

/**
 * How far the `svSignal` sort lifts a read, and whether the filter and the
 * breakpoint split view count it as evidence (ADR-229): 3 for a split read, 2
 * for an SV-size indel, 1 for a discordant pair, 0 for the rest, so discordant
 * short reads do not bury the split reads.
 *
 * Evidence needs both ends placed. A record at MAPQ 0 carries none; a split
 * read counts only when two of its read-adjacent pieces are placed and join
 * (`makesJunction`, the junction its arcs draw and its `svKind` band follows,
 * ADR-258), and a discordant read only when its mate is placed, where the MQ
 * tag says (`mateMapq`, undefined when the file has no MQ). Without that, an
 * Alu's poly-A tail, whose clipped reads land on Alus genome-wide at MAPQ 0,
 * fills an ordinary window with split reads.
 */
export function withSvTier(
  bits: number,
  mapq: number,
  makesJunction: boolean,
  mateMapq: number | undefined,
) {
  const tier = !isPlaced(mapq)
    ? 0
    : bits & READ_SPLIT && makesJunction
      ? 3
      : bits & READ_SV_INDEL
        ? 2
        : bits & READ_DISCORDANT &&
            (mateMapq === undefined || isPlaced(mateMapq))
          ? 1
          : 0
  return bits | (tier << SV_TIER_SHIFT)
}

/** The tier {@link withSvTier} stored; above 0 is SV evidence. */
export function svSignalTier(bits: number) {
  return (bits >> SV_TIER_SHIFT) & 3
}
