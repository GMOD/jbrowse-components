import type { Feature } from '@jbrowse/core/util'

export interface ReducedFeature {
  refName: string
  start: number
  clipPos: number
  end: number
  seqLength: number
}

export function getTag(f: Feature, tag: string) {
  const tags = f.get('tags')
  return tags ? tags[tag] : f.get(tag)
}
