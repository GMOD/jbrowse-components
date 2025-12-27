import type { Feature } from '@jbrowse/core/util'

/**
 * Recursively searches a feature's subfeatures for one with the given ID
 */
export function findSubfeatureById(
  feature: Feature,
  targetId: string,
): Feature | undefined {
  const subfeatures = feature.get('subfeatures')
  if (subfeatures) {
    for (const sub of subfeatures) {
      if (sub.id() === targetId) {
        return sub
      }
      const found = findSubfeatureById(sub, targetId)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

export function hasExonsOrCDS(transcripts: Feature[]) {
  return transcripts.some(t => {
    const subs = t.get('subfeatures') ?? []
    return subs.some(f => f.get('type') === 'exon' || f.get('type') === 'CDS')
  })
}

export function getTranscripts(feature?: Feature): Feature[] {
  if (!feature) {
    return []
  }
  return feature.get('type') === 'mRNA'
    ? [feature]
    : (feature.get('subfeatures') ?? [])
}
