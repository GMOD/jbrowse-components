import { doesIntersect2 } from '@jbrowse/core/util'

import { parseCigar2 } from '../MismatchParser'
import { incWithProbabilities } from './util'
import { getMethBins } from '../ModificationParser/getMethBins'

import type { Mismatch, PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

export function processReferenceCpGs({
  feature,
  region,
  bins,
  regionSequence,
}: {
  bins: PreBaseCoverageBin[]
  feature: Feature
  region: Region
  regionSequence: string
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const seq = feature.get('seq') as string | undefined
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const r = regionSequence.toLowerCase()
  if (seq) {
    const cigarOps =
      feature.get('NUMERIC_CIGAR') ?? parseCigar2(feature.get('CIGAR'))
    const { methBins, methProbs } = getMethBins(feature, cigarOps)
    const dels = mismatches.filter(f => f.type === 'deletion')
    const regionStart = region.start
    const regionEnd = region.end

    // Calculate visible range within feature
    const visStart = Math.max(0, regionStart - fstart)
    const visEnd = Math.min(fend - fstart, regionEnd - fstart)

    // methylation based coloring takes into account both reference sequence
    // CpG detection and reads
    for (let i = visStart; i < visEnd; i++) {
      const j = i + fstart
      const l1 = r[j - regionStart + 1]
      const l2 = r[j - regionStart + 2]
      if (l1 === 'c' && l2 === 'g') {
        const bin0 = bins[j - regionStart]
        const bin1 = bins[j - regionStart + 1]
        const b0 = methBins[i]
        const b1 = methBins[i + 1]
        const p0 = methProbs[i]
        const p1 = methProbs[i + 1]

        // color
        if (
          (b0 && (p0 !== undefined ? p0 > 0.5 : true)) ||
          (b1 && (p1 !== undefined ? p1 > 0.5 : true))
        ) {
          if (bin0) {
            incWithProbabilities(bin0, fstrand, 'mods', 'cpg_meth', p0 || 0)
            bin0.ref.entryDepth--
            bin0.ref[fstrand]--
          }
          if (bin1) {
            incWithProbabilities(bin1, fstrand, 'mods', 'cpg_meth', p1 || 0)
            bin1.ref.entryDepth--
            bin1.ref[fstrand]--
          }
        } else {
          if (bin0) {
            if (
              !dels.some(d =>
                doesIntersect2(
                  j,
                  j + 1,
                  d.start + fstart,
                  d.start + fstart + d.length,
                ),
              )
            ) {
              incWithProbabilities(
                bin0,
                fstrand,
                'nonmods',
                'cpg_unmeth',
                1 - (p0 || 0),
              )
              bin0.ref.entryDepth--
              bin0.ref[fstrand]--
            }
          }
          if (bin1) {
            if (
              !dels.some(d =>
                doesIntersect2(
                  j + 1,
                  j + 2,
                  d.start + fstart,
                  d.start + fstart + d.length,
                ),
              )
            ) {
              incWithProbabilities(
                bin1,
                fstrand,
                'nonmods',
                'cpg_unmeth',
                1 - (p1 || 0),
              )
              bin1.ref.entryDepth--
              bin1.ref[fstrand]--
            }
          }
        }
      }
    }
  }
}
