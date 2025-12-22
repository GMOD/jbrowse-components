import { Feature } from '@jbrowse/core/util'

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
