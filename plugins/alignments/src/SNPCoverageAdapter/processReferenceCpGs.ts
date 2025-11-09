import { parseCigar } from '../MismatchParser'
import { incWithProbabilities } from './util'
import { getMethBins } from '../ModificationParser/getMethBins'

import type { Mismatch, PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

function isPositionInDeletion(
  pos: number,
  dels: Array<{ start: number; length: number }>,
): boolean {
  for (const del of dels) {
    if (pos >= del.start && pos < del.start + del.length) {
      return true
    }
  }
  return false
}

export function processReferenceCpGs({
  feature,
  region,
  bins,
  regionSequence,
  cigarOps: cigarOpsArg,
}: {
  bins: PreBaseCoverageBin[]
  feature: Feature
  region: Region
  regionSequence: string
  cigarOps?: ReturnType<typeof parseCigar>
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const seq = feature.get('seq') as string | undefined
  const mismatches = (feature.get('mismatches') as Mismatch[] | undefined) ?? []
  const r = regionSequence.toLowerCase()
  if (seq) {
    const cigarOps = cigarOpsArg ?? parseCigar(feature.get('CIGAR'))
    const { methBins, methProbs } = getMethBins(feature, cigarOps)
    const dels = mismatches.filter(f => f.type === 'deletion')

    const regionStart = region.start

    // methylation based coloring takes into account both reference sequence
    // CpG detection and reads
    for (let i = 0; i < fend - fstart; i++) {
      const j = i + fstart
      const offset = j - regionStart
      const l1 = r[offset + 1]
      const l2 = r[offset + 2]
      if (l1 === 'c' && l2 === 'g') {
        const bin0 = bins[offset]
        const bin1 = bins[offset + 1]
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
            if (!isPositionInDeletion(j, dels)) {
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
            if (!isPositionInDeletion(j + 1, dels)) {
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
