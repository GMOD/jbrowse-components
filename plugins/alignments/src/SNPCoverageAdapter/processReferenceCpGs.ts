import { doesIntersect2 } from '@jbrowse/core/util'

import { parseCigar2 } from '../MismatchParser'
import { incWithProbabilities } from './util'
import { getMethBins } from '../ModificationParser/getMethBins'
import { CAT_MOD, CAT_NONMOD, MISMATCH_TYPE_DELETION } from '../shared/types'

import type { FlatBaseCoverageBin, Mismatch } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

const STRAND_TO_REF: Record<-1 | 0 | 1, 'refNeg' | 'refZero' | 'refPos'> = {
  [-1]: 'refNeg',
  [0]: 'refZero',
  [1]: 'refPos',
}

export function processReferenceCpGs({
  feature,
  region,
  bins,
  regionSequence,
}: {
  bins: FlatBaseCoverageBin[]
  feature: Feature
  region: Region
  regionSequence: string
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const strandRef = STRAND_TO_REF[fstrand]
  const seq = feature.get('seq') as string | undefined
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const r = regionSequence.toLowerCase()
  if (seq) {
    const cigarOps = parseCigar2(feature.get('CIGAR'))
    const { methBins, methProbs } = getMethBins(feature, cigarOps)
    const dels = mismatches.filter(f => f.type === MISMATCH_TYPE_DELETION)

    for (let i = 0; i < fend - fstart; i++) {
      const j = i + fstart
      const l1 = r[j - region.start + 1]
      const l2 = r[j - region.start + 2]
      if (l1 === 'c' && l2 === 'g') {
        const bin0 = bins[j - region.start]
        const bin1 = bins[j - region.start + 1]
        const b0 = methBins[i]
        const b1 = methBins[i + 1]
        const p0 = methProbs[i]
        const p1 = methProbs[i + 1]

        if (
          (b0 && (p0 !== undefined ? p0 > 0.5 : true)) ||
          (b1 && (p1 !== undefined ? p1 > 0.5 : true))
        ) {
          if (bin0) {
            incWithProbabilities(bin0, fstrand, `${CAT_MOD}cpg_meth`, p0 || 0)
            bin0.refDepth--
            bin0[strandRef]--
          }
          if (bin1) {
            incWithProbabilities(bin1, fstrand, `${CAT_MOD}cpg_meth`, p1 || 0)
            bin1.refDepth--
            bin1[strandRef]--
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
                `${CAT_NONMOD}cpg_unmeth`,
                1 - (p0 || 0),
              )
              bin0.refDepth--
              bin0[strandRef]--
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
                `${CAT_NONMOD}cpg_unmeth`,
                1 - (p1 || 0),
              )
              bin1.refDepth--
              bin1[strandRef]--
            }
          }
        }
      }
    }
  }
}
