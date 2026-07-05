import type { SimpleFeatureSerialized } from '@jbrowse/core/util'

export interface AlignmentFeatureSerialized extends SimpleFeatureSerialized {
  flags?: number
  CIGAR?: string
  next_ref?: string
  next_pos?: number
  tags?: Record<string, unknown>
}

export function getStringTag(tag: string, feat: AlignmentFeatureSerialized) {
  const val = feat.tags?.[tag]
  return typeof val === 'string' ? val : undefined
}
