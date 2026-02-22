import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

import { CIGAR_TYPE_LABELS, getTooltipBin } from './alignmentComponentUtils.ts'

function pct(n: number, total: number) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

import type { CigarHitResult, IndicatorHitResult } from './hitTesting.ts'
import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'

function showWidget(
  model: IAnyStateTreeNode,
  featureData: Record<string, unknown>,
) {
  const session = getSession(model)
  if (isSessionModelWithWidgets(session)) {
    const featureWidget = session.addWidget(
      'BaseFeatureWidget',
      'baseFeature',
      {
        featureData,
        view: getContainingView(model),
        track: getContainingTrack(model),
      },
    )
    session.showWidget(featureWidget)
  }
}

export function openIndicatorWidget(
  model: IAnyStateTreeNode,
  indicatorHit: IndicatorHitResult,
  refName: string,
  blockRpcData: WebGLPileupDataResult | undefined,
) {
  const tooltipBin = getTooltipBin(indicatorHit.position, blockRpcData)
  if (!tooltipBin) {
    return
  }

  const featureData: Record<string, unknown> = {
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
    featureData.count = `${interbaseEntry.count}/${tooltipBin.depth} (${pct(interbaseEntry.count, tooltipBin.depth)})`
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
  blockRpcData: WebGLPileupDataResult | undefined,
) {
  const tooltipBin = getTooltipBin(position, blockRpcData)
  if (!tooltipBin) {
    return
  }

  const featureData: Record<string, unknown> = {
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
      `${interbaseEntry.count}/${tooltipBin.depth} (${pct(interbaseEntry.count, tooltipBin.depth)}) (${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp)`
  }

  showWidget(model, featureData)
}

export function openCigarWidget(
  model: IAnyStateTreeNode,
  cigarHit: CigarHitResult,
  refName: string,
) {
  const featureData: Record<string, unknown> = {
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
