import type { Feature } from '@jbrowse/core/util'

// Read a tag by its canonical name, falling back to a lowercase-suffixed alias
// (e.g. MM/Mm, ML/Ml) as emitted by some aligners.
export function getTagAlt(feature: Feature, tag: string, alt: string) {
  const tags = feature.get('tags') as Record<string, unknown> | undefined
  return tags?.[tag] ?? tags?.[alt]
}
