import type { Feature } from '@jbrowse/core/util'

export function extractFeatureTagValue(feature: Feature, tag: string) {
  const tags = feature.get('tags') as Record<string, unknown> | undefined
  const val = tags ? tags[tag] : feature.get(tag)
  return val != null ? String(val) : ''
}
