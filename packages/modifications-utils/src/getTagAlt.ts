import type { Feature } from '@jbrowse/core/util'

// BAM features (BamSlightlyLazyFeature extends BamRecord) expose getTag, which
// walks the tag block and decodes only the requested tag. Using it instead of
// get('tags') avoids the full _computeTags: a Record allocation plus decoding
// every unrelated tag (NM/AS/ms/de/… — often ~10 per read) that the caller
// never looks at. CRAM/synteny features have no getTag, so fall back to the
// full tags object (already built/cached there).
interface MaybeTagged {
  getTag?: (tag: string) => unknown
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
 */
export function getTagAlt(feature: Feature, tag: string, alt: string) {
  return getTag(feature, tag) ?? getTag(feature, alt)
}
