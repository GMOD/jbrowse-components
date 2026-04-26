import type { Feature } from '@jbrowse/core/util'

// SYNC: keep in sync with drawSyntenyUtils.ts in linear-comparative-view
export function hashString(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
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
