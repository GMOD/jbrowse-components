import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface AlignmentFeatureSerialized extends SimpleFeatureSerialized {
  flags?: number
  CIGAR?: string
  next_ref?: string
  next_pos?: number
  tags?: Record<string, unknown>
}

export function getTag(tag: string, feat: AlignmentFeatureSerialized) {
  return feat.tags?.[tag] ?? feat[tag]
}
