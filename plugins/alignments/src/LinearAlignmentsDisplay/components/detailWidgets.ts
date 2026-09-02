import { openFeatureWidget } from '@jbrowse/core/util'

import { spliceMotifLabel } from '../../features/sashimi/motif.ts'
import { getModificationCallName } from '../../shared/modificationData.ts'
import { getCigarTypeLabel } from '../../shared/types.ts'
import {
  countOfTotal,
  coverageRows,
  formatLenRange,
  getCoverageBin,
  getInterbaseBin,
} from './tooltipUtils.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { CoverageBin, CoverageRow } from './tooltipUtils.ts'
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

// The same breakdown the hover table renders, as widget fields. The Total row
// is dropped because the widget states the depth as its own field.
export function coverageWidgetFields(bin: CoverageBin) {
  return Object.fromEntries(
    coverageRows(bin)
      .filter(row => row.key !== 'total')
      .map(row => [coverageFieldName(row), coverageFieldValue(row)]),
  )
}

function coverageFieldName(row: CoverageRow) {
  return row.base !== undefined
    ? `SNP ${row.label}`
    : row.color !== undefined
      ? `modification ${row.label}`
      : row.label
}

function coverageFieldValue({ reads, avgProb, strands }: CoverageRow) {
  const prob = avgProb === undefined ? '' : ` avg prob ${avgProb}`
  const counts = strands === undefined ? '' : ` (${strands})`
  return `${reads}${prob}${counts}`
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
    ...coverageWidgetFields(bin),
  }

  openFeatureWidget(model, featureData)
}

export function openSashimiWidget(
  model: IAnyStateTreeNode,
  arc: {
    start: number
    end: number
    refName: string
    score: number
    strand: number
    motif: number
  },
) {
  openFeatureWidget(model, {
    // refName:start:end already identifies the arc — the compute layer emits one
    // per junction, tinted by its dominant strand. Strand stays in the uniqueId
    // anyway so a re-tinted junction (a fetch that shifts which strand leads)
    // reads as a new selection rather than silently reusing the old one.
    uniqueId: `sashimi-${arc.refName}-${arc.start}-${arc.end}-${arc.strand}`,
    // Named like its siblings (openIndicatorWidget, openCigarWidget) so the
    // widget has a heading; without one it opened titled by nothing, leaving the
    // bare `type: 'skip'` to explain what had been clicked.
    name: 'Splice junction',
    type: 'skip',
    refName: arc.refName,
    start: arc.start,
    end: arc.end,
    score: arc.score,
    strand: arc.strand,
    ...(spliceMotifLabel(arc.motif) === undefined
      ? {}
      : { splice_motif: spliceMotifLabel(arc.motif) }),
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
  if (cigarHit.qual !== undefined) {
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
