import { createEmptyBin, incWithProbabilities } from './util.ts'
import { parseCigar2 } from '../MismatchParser/index.ts'
import { getMethBins } from '../ModificationParser/getMethBins.ts'
import { DELETION_TYPE } from '../shared/forEachMismatchTypes.ts'

import type {
  FeatureWithMismatchIterator,
  PreBaseCoverageBin,
} from '../shared/types.ts'
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
  feature: FeatureWithMismatchIterator
  region: Region
  regionSequence: string
}) {
  const fstart = feature.get('start')
  const fend = feature.get('end')
  const fstrand = feature.get('strand') as -1 | 0 | 1
  const seq = feature.get('seq') as string | undefined
  const r = regionSequence.toLowerCase()
  if (seq) {
    const cigarOps =
      feature.get('NUMERIC_CIGAR') ?? parseCigar2(feature.get('CIGAR'))
    const { methBins, methProbs } = getMethBins(feature, cigarOps)
    const isDeleted = new Array(methBins.length).fill(false)
    feature.forEachMismatch((type, start, length) => {
      if (type === DELETION_TYPE) {
        const end = start + length
        for (let i = start; i < end; i++) {
          isDeleted[i] = true
        }
      }
    })
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
        const isDel0 = isDeleted[i]
        const isDel1 = isDeleted[i + 1]

        processCpG(bins, idx0, fstrand, isMeth, p0, !!isDel0)
        processCpG(bins, idx1, fstrand, isMeth, p1, !!isDel1)
      }
    }
  }
}
