import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/alignments-core'

import type { PileupDataResult } from '../../RenderPileupDataRPC/types.ts'

// Single source of truth for sashimi arc geometry, color, and stroke width.
// Both the on-screen `SashimiArcsOverlay` (which adds hover/click handlers)
// and the SVG export (which serializes static <path>s) consume this output.
//
// Sashimi stays rendered as vector SVG by design — arc counts are low, vector
// performance is fine, and SVG paths give native hover/tooltip behavior.
// Keeping the geometry computation shared prevents the on-screen and export
// paths from drifting (e.g. cubic vs quadratic Bezier, different palettes).
export interface SashimiArc {
  d: string
  stroke: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  score: number
  strand: number
}

export interface ComputeSashimiArcsOpts {
  rpcDataMap: ReadonlyMap<number, PileupDataResult>
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
  }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  coverageHeight: number
  sashimiArcsHeight: number
  sashimiArcsDown: boolean
}

function getArcColor(strand: number) {
  if (strand === 1) {
    return 'rgba(255,170,170,0.7)'
  }
  if (strand === -1) {
    return 'rgba(160,160,255,0.7)'
  }
  return 'rgba(200,200,200,0.7)'
}

export function computeSashimiArcs(opts: ComputeSashimiArcsOpts) {
  const {
    rpcDataMap,
    visibleRegions,
    bpToScreenX,
    coverageHeight,
    sashimiArcsHeight,
    sashimiArcsDown,
  } = opts
  const effectiveHeight = coverageHeight - YSCALEBAR_LABEL_OFFSET
  const baseline = sashimiArcsDown ? 0 : effectiveHeight * 0.9
  const peak = sashimiArcsDown ? sashimiArcsHeight * 0.9 : effectiveHeight * 0.1

  const arcs: SashimiArc[] = []
  for (const region of visibleRegions) {
    const rpcData = rpcDataMap.get(region.displayedRegionIndex)
    if (!rpcData || rpcData.numSashimiArcs === 0) {
      continue
    }
    const { refName } = region
    const {
      sashimiX1,
      sashimiX2,
      sashimiCounts,
      sashimiColorTypes,
      sashimiScores,
      numSashimiArcs,
    } = rpcData

    for (let i = 0; i < numSashimiArcs; i++) {
      const startBp = sashimiX1[i]!
      const endBp = sashimiX2[i]!
      const left = bpToScreenX(refName, startBp)
      const right = bpToScreenX(refName, endBp)
      if (left === undefined || right === undefined) {
        continue
      }
      const strand = sashimiColorTypes[i] === 0 ? 1 : -1
      arcs.push({
        d: `M ${left} ${baseline} C ${left} ${peak}, ${right} ${peak}, ${right} ${baseline}`,
        stroke: getArcColor(strand),
        strokeWidth: sashimiScores[i]!,
        start: startBp,
        end: endBp,
        refName,
        score: sashimiCounts[i]!,
        strand,
      })
    }
  }
  return arcs
}
