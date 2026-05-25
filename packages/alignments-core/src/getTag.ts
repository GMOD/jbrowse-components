import type { Feature } from '@jbrowse/core/util'

export function getTag(feature: Feature, tag: string) {
  return feature.get('tags')?.[tag]
}
