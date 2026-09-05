import { getSubfeatures, isCDS } from '../util.ts'

import type { CdsSegment } from './aggregateAminoAcids.ts'
import type { Feature } from '@jbrowse/core/util'

// A GFF3 file can repeat a CDS row, and the duplicated bases stitch into the
// translated sequence and frameshift the protein. The overlay and the
// translation both derive their segments here, so their dedup cannot drift.
export function dedupedSortedCDS(feature: Feature): CdsSegment[] {
  const seen = new Set<string>()
  const cds: CdsSegment[] = []
  const subfeatures = [...getSubfeatures(feature)].sort(
    (a, b) => a.get('start') - b.get('start'),
  )
  for (const sub of subfeatures) {
    const start = sub.get('start')
    const end = sub.get('end')
    if (isCDS(sub) && start < end) {
      const key = `${start}-${end}`
      if (!seen.has(key)) {
        seen.add(key)
        cds.push({ start, end, phase: sub.get('phase') ?? 0 })
      }
    }
  }
  // A standalone polyprotein CDS carries cleavage products rather than CDS
  // segments, so the loop above finds none and the feature's own span is the
  // single translation segment.
  if (cds.length === 0 && isCDS(feature)) {
    const start = feature.get('start')
    const end = feature.get('end')
    if (start < end) {
      cds.push({ start, end, phase: feature.get('phase') ?? 0 })
    }
  }
  return cds
}
