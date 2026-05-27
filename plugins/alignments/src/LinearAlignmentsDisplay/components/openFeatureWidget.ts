import { openFeatureWidget as showWidget } from '@jbrowse/core/util'

import { CIGAR_TYPE_LABELS } from './alignmentComponentUtils.ts'
import { getTooltipBin, pct } from './tooltipUtils.ts'
import { getModificationName } from '../../shared/modificationData.ts'

import type { ModificationHitResult } from '../../features/modification/hitTest.ts'
import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'
import type { IndicatorHitResult } from '../../features/indicator/types.ts'
import type { CigarHitResult } from '../../shared/hitTestTypes.ts'
import type { SimpleFeatureSerialized } from '@jbrowse/core/util'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

export function openIndicatorWidget(
  model: IAnyStateTreeNode,
  indicatorHit: IndicatorHitResult,
  refName: string,
  blockRpcData: PileupDataResult | undefined,
) {
  const tooltipBin = getTooltipBin(indicatorHit.position, blockRpcData)
  if (!tooltipBin) {
    return
  }

  const featureData: SimpleFeatureSerialized = {
    uniqueId: `indicator-${indicatorHit.indicatorType}-${refName}-${indicatorHit.position}`,
    name: `Coverage ${CIGAR_TYPE_LABELS[indicatorHit.indicatorType] ?? indicatorHit.indicatorType}`,
    type: indicatorHit.indicatorType,
    refName,
    start: indicatorHit.position,
    end: indicatorHit.position + 1,
    depth: tooltipBin.depth,
  }

  const interbaseEntry = tooltipBin.interbase[indicatorHit.indicatorType]
  if (interbaseEntry) {
    featureData.count = `${interbaseEntry.count}/${tooltipBin.interbaseDepth} (${pct(interbaseEntry.count, tooltipBin.interbaseDepth)})`
    featureData.size =
      interbaseEntry.minLen === interbaseEntry.maxLen
        ? `${interbaseEntry.minLen}bp`
        : `${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp (avg ${interbaseEntry.avgLen.toFixed(1)}bp)`
    if (interbaseEntry.topSeq) {
      featureData['top sequence'] =
        `${interbaseEntry.topSeq} (${interbaseEntry.topSeqCount}/${interbaseEntry.count} reads)`
    }
  }

  showWidget(model, featureData)
}

export function openCoverageWidget(
  model: IAnyStateTreeNode,
  position: number,
  refName: string,
  blockRpcData: PileupDataResult | undefined,
  modType?: string,
) {
  const tooltipBin = getTooltipBin(position, blockRpcData)
  if (!tooltipBin) {
    return
  }

  const featureData: SimpleFeatureSerialized = {
    uniqueId: `coverage-${refName}-${position}`,
    name: 'Coverage',
    type: 'coverage',
    refName,
    start: position,
    end: position + 1,
    depth: tooltipBin.depth,
  }

  for (const [base, snpEntry] of Object.entries(tooltipBin.snps)) {
    featureData[`SNP ${base.toUpperCase()}`] =
      `${snpEntry.count}/${tooltipBin.depth} (${pct(snpEntry.count, tooltipBin.depth)}) (${snpEntry.fwd}(+) ${snpEntry.rev}(-))`
  }
  for (const [type, interbaseEntry] of Object.entries(tooltipBin.interbase)) {
    featureData[type] =
      `${interbaseEntry.count}/${tooltipBin.interbaseDepth} (${pct(interbaseEntry.count, tooltipBin.interbaseDepth)}) (${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp)`
  }
  const modifications =
    modType && tooltipBin.modifications?.[modType]
      ? { [modType]: tooltipBin.modifications[modType] }
      : tooltipBin.modifications
  if (modifications) {
    for (const [, entry] of Object.entries(modifications)) {
      const avgProb = entry.count > 0 ? entry.probabilityTotal / entry.count : 0
      featureData[`modification ${entry.name}`] =
        `${entry.count}/${tooltipBin.depth} (${pct(entry.count, tooltipBin.depth)}) avg prob ${avgProb.toFixed(2)} (${entry.fwd}(+) ${entry.rev}(-))`
    }
  }

  showWidget(model, featureData)
}

export function openSashimiWidget(
  model: IAnyStateTreeNode,
  arc: {
    start: number
    end: number
    refName: string
    score: number
    strand: number
  },
) {
  showWidget(model, {
    uniqueId: `sashimi-${arc.refName}-${arc.start}-${arc.end}`,
    type: 'skip',
    refName: arc.refName,
    start: arc.start,
    end: arc.end,
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
    name: modHit.modType ? getModificationName(modHit.modType) : 'Modification',
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
  showWidget(model, featureData)
}

export function openCigarWidget(
  model: IAnyStateTreeNode,
  cigarHit: CigarHitResult,
  refName: string,
) {
  const featureData: SimpleFeatureSerialized = {
    uniqueId: `${cigarHit.type}-${refName}-${cigarHit.position}`,
    name: CIGAR_TYPE_LABELS[cigarHit.type] ?? cigarHit.type,
    type: cigarHit.type,
    refName,
    start: cigarHit.position,
    end: cigarHit.position + (cigarHit.length ?? 1),
  }

  if (cigarHit.type === 'mismatch' && cigarHit.base) {
    featureData.base = cigarHit.base
  } else if (cigarHit.type === 'insertion') {
    featureData.length = cigarHit.length
    if (cigarHit.sequence) {
      featureData.sequence = cigarHit.sequence
    }
  } else if (
    cigarHit.type === 'deletion' ||
    cigarHit.type === 'skip' ||
    cigarHit.type === 'softclip' ||
    cigarHit.type === 'hardclip'
  ) {
    featureData.length = cigarHit.length
  }

  showWidget(model, featureData)
}
