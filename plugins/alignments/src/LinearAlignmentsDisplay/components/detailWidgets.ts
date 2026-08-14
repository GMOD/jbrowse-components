import { openFeatureWidget } from '@jbrowse/core/util'

import { getModificationCallName } from '../../shared/modificationData.ts'
import { getCigarTypeLabel } from '../../shared/types.ts'
import {
  countOfTotal,
  formatLenRange,
  getCoverageBin,
  getInterbaseBin,
} from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export function openIndicatorWidget(
  model: IAnyStateTreeNode,
  indicatorHit: IndicatorHitResult,
  refName: string,
  blockRpcData: PileupDataResult | undefined,
) {
  // Same interbase-only bin the hover tooltip reads, so a hoverable bar is
  // exactly a clickable one — the depth/SNP tallies play no part here.
  const bin = getInterbaseBin(indicatorHit.position, blockRpcData)
  if (!bin) {
    return
  }

  const featureData: SimpleFeatureSerialized = {
    uniqueId: `indicator-${indicatorHit.indicatorType}-${refName}-${indicatorHit.position}`,
    name: `Coverage ${getCigarTypeLabel(indicatorHit.indicatorType)}`,
    type: indicatorHit.indicatorType,
    refName,
    start: indicatorHit.position,
    end: indicatorHit.position + 1,
    depth: bin.depth,
  }

  const interbaseEntry = bin.interbase[indicatorHit.indicatorType]
  if (interbaseEntry) {
    featureData.count = countOfTotal(interbaseEntry.count, bin.interbaseDepth)
    // The avg only says something when the range doesn't collapse to one length.
    const sizeStr = formatLenRange(interbaseEntry.minLen, interbaseEntry.maxLen)
    featureData.size =
      interbaseEntry.minLen === interbaseEntry.maxLen
        ? sizeStr
        : `${sizeStr} (avg ${interbaseEntry.avgLen.toFixed(1)}bp)`
    if (interbaseEntry.topSeq) {
      featureData['top sequence'] =
        `${interbaseEntry.topSeq} (${interbaseEntry.topSeqCount}/${interbaseEntry.count} reads)`
    }
  }

  openFeatureWidget(model, featureData)
}

export function openCoverageWidget(
  model: IAnyStateTreeNode,
  position: number,
  refName: string,
  blockRpcData: PileupDataResult | undefined,
) {
  // Coverage widget omits interbase — those are reached by clicking the
  // interbase histogram bars (openIndicatorWidget).
  const bin = getCoverageBin(position, blockRpcData)
  if (!bin) {
    return
  }

  const featureData: SimpleFeatureSerialized = {
    uniqueId: `coverage-${refName}-${position}`,
    name: 'Coverage',
    type: 'coverage',
    refName,
    start: position,
    end: position + 1,
    depth: bin.depth,
  }

  for (const [base, snpEntry] of Object.entries(bin.snps)) {
    featureData[`SNP ${base.toUpperCase()}`] =
      `${countOfTotal(snpEntry.count, bin.depth)} (${snpEntry.fwd}(+) ${snpEntry.rev}(-))`
  }
  if (bin.modifications) {
    for (const entry of bin.modifications) {
      const avgProb = entry.count > 0 ? entry.probabilityTotal / entry.count : 0
      featureData[`modification ${entry.name}`] =
        `${countOfTotal(entry.count, bin.depth)} avg prob ${(avgProb * 100).toFixed(1)}% (${entry.fwd}(+) ${entry.rev}(-))`
    }
  }

  openFeatureWidget(model, featureData)
}

export function openSashimiWidget(
  model: IAnyStateTreeNode,
  arc: {
    start: number
    end: number
    refName: string
    endRefName: string
    score: number
    strand: number
    title: string
  },
) {
  // A junction across two chromosomes — only a split read produces one — has no
  // single range to be a feature over. It gets a point feature at its first end
  // plus a `partner` field naming the second, rather than a `start`/`end` pair
  // spanning two number lines, which renders as a negative-length location and
  // would send "show in new view" somewhere meaningless.
  const interchrom = arc.refName !== arc.endRefName
  openFeatureWidget(model, {
    // The two loci already identify the arc — each compute layer emits one per
    // junction, tinted by its dominant strand. Strand stays in the uniqueId
    // anyway so a re-tinted junction (a fetch that shifts which strand leads)
    // reads as a new selection rather than silently reusing the old one.
    uniqueId: `sashimi-${arc.refName}-${arc.start}-${arc.endRefName}-${arc.end}-${arc.strand}`,
    // Named like its siblings (openIndicatorWidget, openCigarWidget) so the
    // widget has a heading; without one it opened titled by nothing, leaving the
    // bare `type` to explain what had been clicked. The arc's own `title` says
    // which junction kind this is, so the two sources don't need two callers.
    name: arc.title,
    type: interchrom ? 'split_junction' : 'skip',
    refName: arc.refName,
    start: arc.start,
    end: interchrom ? arc.start + 1 : arc.end,
    ...(interchrom ? { partner: `${arc.endRefName}:${arc.end + 1}` } : {}),
    score: arc.score,
    strand: arc.strand,
  })
}

// Per-read modification details, parallel to openCigarWidget for a mismatch.
// The coverage-level aggregate (count, avg prob, strands) is shown by clicking
// the coverage bar; this widget reports the single read's call at this base.
export function openModificationWidget(
  model: IAnyStateTreeNode,
  modHit: ModificationHitResult,
  refName: string,
  snpBase: string | undefined,
) {
  const featureData: SimpleFeatureSerialized = {
    uniqueId: `modification-${refName}-${modHit.position}-${modHit.modType ?? 'unknown'}`,
    name: modHit.modType
      ? getModificationCallName(modHit.modType, modHit.noMod)
      : 'Modification',
    type: 'modification',
    refName,
    start: modHit.position,
    end: modHit.position + 1,
    modType: modHit.modType,
    probability: `${(modHit.probability * 100).toFixed(1)}%`,
    color: modHit.color,
  }
  if (snpBase) {
    featureData.snpBase = snpBase
  }
  openFeatureWidget(model, featureData)
}

export function openCigarWidget(
  model: IAnyStateTreeNode,
  cigarHit: CigarHitResult,
  refName: string,
) {
  const featureData: SimpleFeatureSerialized = {
    uniqueId: `${cigarHit.type}-${refName}-${cigarHit.position}`,
    name: getCigarTypeLabel(cigarHit.type),
    type: cigarHit.type,
    refName,
    start: cigarHit.position,
    end: cigarHit.position + cigarHit.length,
  }

  // base (mismatch) and sequence (insertion) are populated mutually exclusively
  // by the hit-testers, so copy whichever the hit carries rather than
  // re-deriving the type here. Length is reported only when it says something:
  // every mismatch is 1bp, so a "Length: 1" row is noise.
  if (cigarHit.base) {
    featureData.base = cigarHit.base
  }
  if (cigarHit.qual) {
    featureData.quality = cigarHit.qual
  }
  if (cigarHit.length > 1) {
    featureData.length = cigarHit.length
  }
  if (cigarHit.sequence) {
    featureData.sequence = cigarHit.sequence
  }

  openFeatureWidget(model, featureData)
}
