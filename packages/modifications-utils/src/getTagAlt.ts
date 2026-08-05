import type { Feature } from '@jbrowse/core/util'

// BAM features (BamSlightlyLazyFeature extends BamRecord) expose getTag, which
// walks the tag block and decodes only the requested tag. Using it instead of
// get('tags') avoids the full _computeTags: a Record allocation plus decoding
// every unrelated tag (NM/AS/ms/de/… — often ~10 per read) that the caller
// never looks at. CRAM/synteny features have no getTag, so fall back to the
// full tags object (already built/cached there).
interface MaybeTagged {
  getTag?: (tag: string) => unknown
  getTagAlt?: (tag: string, alt: string) => unknown
}

/**
 * #api
 * Read a single tag by name, using the feature's targeted tag accessor when it
 * has one (BAM) and the full tags object otherwise (CRAM/synteny).
 */
export function getTag(feature: Feature, tag: string) {
  const getter = (feature as unknown as MaybeTagged).getTag
  if (getter) {
    return getter.call(feature, tag)
  }
  return (feature.get('tags') as Record<string, unknown> | undefined)?.[tag]
}

/**
 * #api
 * Read a tag by its canonical name, falling back to a lowercase-suffixed alias
 * (e.g. MM/Mm, ML/Ml) as emitted by some aligners.
 *
 * Prefers the feature's own one-pass alias lookup when it has one. The plain
 * `getTag(tag) ?? getTag(alt)` form walks the record's whole tag block TWICE
 * whenever neither name is present — which is every read in a file without base
 * modifications, and this is called per read on every render. On jb2bench's
 * 1000x.shortread that pair of walks was 12.9% of the whole BAM query, more
 * than the CIGAR/SEQ/MD reads the pileup actually uses.
 */
export function getTagAlt(feature: Feature, tag: string, alt: string) {
  const both = (feature as unknown as MaybeTagged).getTagAlt
  if (both) {
    return both.call(feature, tag, alt)
  }
  return getTag(feature, tag) ?? getTag(feature, alt)
}
