import { isCDS } from '../util.ts'

import type { CdsSegment } from './aggregateAminoAcids.ts'
import type { Feature } from '@jbrowse/core/util'

// Absolute-coordinate CDS segments, ascending by genomic start and deduped on
// start/end. GFF3 files (e.g. Gencode v36) can repeat a CDS row; left in, the
// duplicated bases stitch into the translated sequence and frameshift the
// protein. Both the amino-acid overlay (transcriptCDS in collectRenderData) and
// the peptide translation (extractCDSRegions in peptideUtils) derive from this
// single function, so their dedup can never drift — if they disagreed, the
// rendered residues would misalign with the protein string.
export function dedupedSortedCDS(feature: Feature): CdsSegment[] {
  const seen = new Set<string>()
  const cds: CdsSegment[] = []
  const subfeatures = [...(feature.get('subfeatures') ?? [])].sort(
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
  return cds
}
