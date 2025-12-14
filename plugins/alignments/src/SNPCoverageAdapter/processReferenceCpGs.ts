import { doesIntersect2 } from '@jbrowse/core/util'

import { parseCigar2 } from '../MismatchParser'
import { createEmptyBin, incWithProbabilities } from './util'
import { getMethBins } from '../ModificationParser/getMethBins'

import type { Mismatch, PreBaseCoverageBin } from '../shared/types'
import type { Feature } from '@jbrowse/core/util'
import type { AugmentedRegion as Region } from '@jbrowse/core/util/types'

function processCpG(
  bins: PreBaseCoverageBin[],
  binIdx: number,
  fstrand: -1 | 0 | 1,
  isMeth: boolean,
  prob: number,
  isDel: boolean,
) {
  if (isMeth) {
    const bin = (bins[binIdx] ??= createEmptyBin())
    incWithProbabilities(bin, fstrand, 'mods', 'cpg_meth', prob)
    bin.ref.entryDepth--
    bin.ref[fstrand]--
  } else {
    if (!isDel) {
      const bin = (bins[binIdx] ??= createEmptyBin())
      incWithProbabilities(bin, fstrand, 'nonmods', 'cpg_unmeth', 1 - prob)
      bin.ref.entryDepth--
      bin.ref[fstrand]--
    }
  }
}

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
        const idx0 = j - regionStart
        const idx1 = j - regionStart + 1
        const b0 = methBins[i]
        const b1 = methBins[i + 1]
        const p0 = methProbs[i] || 0
        const p1 = methProbs[i + 1] || 0
        const isMeth = !!((b0 && p0 > 0.5) || (b1 && p1 > 0.5))
        const isDel0 = dels.some(d =>
          doesIntersect2(
            j,
            j + 1,
            d.start + fstart,
            d.start + fstart + d.length,
          ),
        )
        const isDel1 = dels.some(d =>
          doesIntersect2(
            j + 1,
            j + 2,
            d.start + fstart,
            d.start + fstart + d.length,
          ),
        )

        processCpG(bins, idx0, fstrand, isMeth, p0, isDel0)
        processCpG(bins, idx1, fstrand, isMeth, p1, isDel1)
      }
    }
  }
}
