import type { ReducedFeature } from './fetchChains'

/**
 * Gets the primary strand for a feature, handling both primary and supplementary alignments.
 *
 * For non-supplementary alignments (!(flags & 2048)), uses the feature's strand property.
 * For supplementary alignments, parses the SA tag to get the primary alignment's strand.
 *
 * @param feat - The feature to get the primary strand from
 * @returns The primary strand (-1 for reverse, 1 for forward, or undefined if SA tag is missing)
 */
export function getPrimaryStrand(feat: ReducedFeature) {
  // Check if this is not a supplementary alignment (flag 2048)
  if (!(feat.flags & 2048)) {
    return feat.strand
  } else {
    // Parse SA tag to get primary alignment strand
    const res = feat.SA?.split(';')[0]?.split(',')[2]
    return res === '-' ? -1 : 1
  }
}

/**
 * Gets the primary strand for a feature by checking the reverse complement flag.
 *
 * For non-supplementary alignments (!(flags & 2048)), checks flag 16 (reverse complement).
 * For supplementary alignments, parses the SA tag to get the primary alignment's strand.
 *
 * @param feat - The feature to get the primary strand from
 * @returns The primary strand (-1 for reverse, 1 for forward, or undefined if SA tag is missing)
 */
export function getPrimaryStrandFromFlags(feat: ReducedFeature) {
  // Check if this is not a supplementary alignment (flag 2048)
  if (!(feat.flags & 2048)) {
    return feat.flags & 16 ? -1 : 1
  } else {
    // Parse SA tag to get primary alignment strand
    const res = feat.SA?.split(';')[0]?.split(',')[2]
    return res === '-' ? -1 : 1
  }
}
