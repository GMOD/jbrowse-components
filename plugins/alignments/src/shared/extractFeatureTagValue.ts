import type { Feature } from '@jbrowse/core/util'

// BAM features expose a targeted `getTag` that walks the tag block and decodes
// only the requested tag. Duck-typed here rather than declared on `Feature`, the
// same way `@jbrowse/modifications-utils`' getTag() does it — that helper can't
// just be called here because it has no equivalent of the `feature.get(tag)`
// fallback below.
//
// The fallback is why: `get('tags')` runs the full decode — a Record allocation
// plus every unrelated tag on the read (NM/AS/ms/de/…, often ~10) — to answer
// one, and this is on the adapter hot path, called per read for colorBy.tag,
// sortTag and the `hasSA` group predicate. A record carrying the accessor always
// has a tag block (`_computeTags` returns an object even when empty), so the
// fallback never applied to it; it exists for the flagless features that share
// this pipeline (PAF/synteny blocks), which carry no tags object at all and may
// keep the value as a plain field.
interface MaybeTagged {
  getTag?: (tag: string) => unknown
}

export function extractFeatureTagValue(feature: Feature, tag: string) {
  const getter = (feature as unknown as MaybeTagged).getTag
  let val: unknown
  if (getter) {
    val = getter.call(feature, tag)
  } else {
    const tags = feature.get('tags') as Record<string, unknown> | undefined
    val = tags ? tags[tag] : feature.get(tag)
  }
  return val != null ? String(val) : ''
}
