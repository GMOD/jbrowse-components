import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'

import { CIGAR_TYPE_LABELS } from './alignmentComponentUtils.ts'

function pct(n: number, total: number) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

import type {
  CigarHitResult,
  CoverageHitResult,
  IndicatorHitResult,
} from './hitTesting.ts'
import type { WebGLPileupDataResult } from '../../RenderWebGLPileupDataRPC/types.ts'

interface ModelForWidget {
  loadedRegion: { refName: string; start: number; end: number } | null
}

function showWidget(
  model: ModelForWidget,
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
  model: ModelForWidget,
  indicatorHit: IndicatorHitResult,
  refName: string,
  blockRpcData: WebGLPileupDataResult | undefined,
) {
  const posOffset = indicatorHit.position - (blockRpcData?.regionStart ?? 0)
  const tooltipBin = blockRpcData?.tooltipData[posOffset]

  const featureData: Record<string, unknown> = {
    uniqueId: `indicator-${indicatorHit.indicatorType}-${refName}-${indicatorHit.position}`,
    name: `Coverage ${CIGAR_TYPE_LABELS[indicatorHit.indicatorType] ?? indicatorHit.indicatorType}`,
    type: indicatorHit.indicatorType,
    refName,
    start: indicatorHit.position,
    end: indicatorHit.position + 1,
  }

  if (tooltipBin) {
    const interbaseEntry = tooltipBin.interbase[indicatorHit.indicatorType]
    if (interbaseEntry) {
      featureData.count = `${interbaseEntry.count}/${tooltipBin.depth} (${pct(interbaseEntry.count, tooltipBin.depth)})`
      featureData.size =
        interbaseEntry.minLen === interbaseEntry.maxLen
          ? `${interbaseEntry.minLen}bp`
          : `${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp (avg ${interbaseEntry.avgLen.toFixed(1)}bp)`
      if (interbaseEntry.topSeq) {
        featureData.sequence = interbaseEntry.topSeq
      }
    }
    featureData.depth = tooltipBin.depth
  } else {
    const { counts } = indicatorHit
    featureData.count = counts.insertion + counts.softclip + counts.hardclip
  }

  showWidget(model, featureData)
}

export function openCoverageWidget(
  model: ModelForWidget,
  coverageHit: CoverageHitResult,
  refName: string,
  blockRpcData: WebGLPileupDataResult | undefined,
) {
  const posOffset = coverageHit.position - (blockRpcData?.regionStart ?? 0)
  const tooltipBin = blockRpcData?.tooltipData[posOffset]

  const hasSNPs = coverageHit.snps.some(
    s => s.base === 'A' || s.base === 'C' || s.base === 'G' || s.base === 'T',
  )
  const hasInterbase = coverageHit.snps.some(
    s =>
      s.base === 'insertion' || s.base === 'softclip' || s.base === 'hardclip',
  )
  if (!hasSNPs && !hasInterbase && !tooltipBin) {
    return
  }

  const featureData: Record<string, unknown> = {
    uniqueId: `coverage-${refName}-${coverageHit.position}`,
    name: 'Coverage',
    type: 'coverage',
    refName,
    start: coverageHit.position,
    end: coverageHit.position + 1,
    depth: coverageHit.depth,
  }

  if (tooltipBin) {
    for (const [base, entry] of Object.entries(tooltipBin.snps)) {
      const snpEntry = entry as
        | { count: number; fwd: number; rev: number }
        | undefined
      if (snpEntry) {
        featureData[`SNP ${base.toUpperCase()}`] =
          `${snpEntry.count}/${tooltipBin.depth} (${pct(snpEntry.count, tooltipBin.depth)}) (${snpEntry.fwd}(+) ${snpEntry.rev}(-))`
      }
    }
    for (const [type, entry] of Object.entries(tooltipBin.interbase)) {
      const interbaseEntry = entry as
        | {
            count: number
            minLen: number
            maxLen: number
            avgLen: number
            topSeq?: string
          }
        | undefined
      if (interbaseEntry) {
        featureData[type] =
          `${interbaseEntry.count}/${tooltipBin.depth} (${pct(interbaseEntry.count, tooltipBin.depth)}) (${interbaseEntry.minLen}-${interbaseEntry.maxLen}bp)`
      }
    }
  } else {
    for (const snp of coverageHit.snps) {
      featureData[snp.base] = snp.count
    }
  }

  showWidget(model, featureData)
}

export function openCigarWidget(
  model: ModelForWidget,
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
