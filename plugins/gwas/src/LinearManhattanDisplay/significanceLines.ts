import { getScale } from '@jbrowse/wiggle-core'

// LocusZoom-style cutoff colors: red for genome-wide, blue for suggestive.
export const GENOME_WIDE_COLOR = '#d43f3a'
export const SUGGESTIVE_COLOR = '#357ebd'

export interface SignificanceLine {
  value: number
  y: number
  color: string
  label: string
}

interface ThresholdDef {
  value: number
  color: string
  label: string
}

// Map -log10(p) cutoff values to overlay Y positions using the same d3 scale
// as the YScaleBar (range [yBottom, yTop]), so a line lands exactly on its
// axis value. Cutoffs outside the current domain are dropped — drawing them
// pinned to an edge would misrepresent where the threshold sits.
export function buildSignificanceLines({
  thresholds,
  domain,
  height,
  offset,
}: {
  thresholds: ThresholdDef[]
  domain: [number, number]
  height: number
  offset: number
}): SignificanceLine[] {
  const [domainMin, domainMax] = domain
  const scale = getScale({
    scaleType: 'linear',
    domain: [domainMin, domainMax],
    range: [height - offset - 1, offset],
    inverted: false,
  })
  return thresholds
    .filter(t => t.value > domainMin && t.value < domainMax)
    .map(t => ({
      value: t.value,
      y: scale(t.value),
      color: t.color,
      label: t.label,
    }))
}
