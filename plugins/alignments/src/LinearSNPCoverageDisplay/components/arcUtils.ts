import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'

export interface ArcData {
  id: string
  path: string
  stroke: string
  strokeWidth: number
  start: number
  end: number
  refName: string
  score: number
  strand: number
}

export function getArcColor(strand: number) {
  return strand === 1
    ? 'rgba(255,200,200,0.7)'
    : strand === -1
      ? 'rgba(200,200,255,0.7)'
      : 'rgba(200,200,200,0.7)'
}

export function getStrandLabel(strand: number) {
  return strand === 1 ? '+' : strand === -1 ? '-' : 'unknown'
}

export function featureToArcData(
  feature: Feature,
  view: LinearGenomeViewModel,
  effectiveHeight: number,
  offsetPx: number,
  assembly: Assembly,
): ArcData | undefined {
  const start = feature.get('start')
  const end = feature.get('end')
  const refName = assembly.getCanonicalRefName2(feature.get('refName'))

  const startPx = view.bpToPx({ refName, coord: start })
  const endPx = view.bpToPx({ refName, coord: end })

  if (startPx === undefined || endPx === undefined) {
    return undefined
  }

  const left = startPx.offsetPx - offsetPx
  const right = endPx.offsetPx - offsetPx
  const strand = feature.get('effectiveStrand') ?? 0
  const score = feature.get('score') ?? 1

  return {
    id: feature.id(),
    path: `M ${left} ${effectiveHeight * 0.9} C ${left} ${effectiveHeight * 0.1}, ${right} ${effectiveHeight * 0.1}, ${right} ${effectiveHeight * 0.9}`,
    stroke: getArcColor(strand),
    strokeWidth: Math.log(score + 1),
    start,
    end,
    refName,
    score,
    strand,
  }
}
