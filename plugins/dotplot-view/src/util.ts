import type { Feature } from '@jbrowse/core/util'

export function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

export interface ReducedFeature {
  refName: string
  start: number
  clipLengthAtStartOfRead: number
  end: number
  seqLength: number
}

export function getTag(f: Feature, tag: string) {
  const tags = f.get('tags')
  return tags ? tags[tag] : f.get(tag)
}
