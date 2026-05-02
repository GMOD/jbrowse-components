import { YSCALEBAR_LABEL_OFFSET, niceStep } from '@jbrowse/alignments-core'

import type { YScaleTicks } from './components/YScaleBar.tsx'

// Format bp values with a compact unit (matches the X-axis ruler style).
function formatBp(v: number) {
  if (v === 0) {
    return '0'
  }
  if (v >= 1_000_000) {
    const mb = v / 1_000_000
    return `${mb % 1 === 0 ? mb : mb.toFixed(1)}Mb`
  }
  if (v >= 1000) {
    const kb = v / 1000
    return `${kb % 1 === 0 ? kb : kb.toFixed(1)}kb`
  }
  return `${v}bp`
}

// Samplot Y axis: availH pixels span [0, arcsYDomainBp] bp. Ticks labeled
// in bp/kb/Mb at nice-step intervals. Y positions are returned in the
// **display's** coordinate space. The axis is inset by YSCALEBAR_LABEL_OFFSET
// at both ends so it aligns exactly with the left-side CoverageYScaleBar
// (which uses the same inset) when arcs are in the coverage area.
//
// Insert-size 0 sits at the arc anchors (where arcs meet the coverage/pileup
// edge), and the max domain value sits at the arc apex:
//
//   pointing-up (!pairedArcsDown): anchors near the BOTTOM of the arcs band,
//                                   apex toward top — ticks ascend upward
//   pointing-down (pairedArcsDown): anchors near the TOP of the arcs band,
//                                   apex toward bottom — ticks descend
export function computeInsertSizeTicks({
  arcsYDomainBp,
  arcsHeight,
  pairedArcsDown,
  arcsTop,
}: {
  arcsYDomainBp: number
  arcsHeight: number
  pairedArcsDown: boolean
  arcsTop: number
}): YScaleTicks | undefined {
  if (
    !Number.isFinite(arcsYDomainBp) ||
    !Number.isFinite(arcsHeight) ||
    !Number.isFinite(arcsTop)
  ) {
    return undefined
  }
  const availH = arcsHeight - 2 * YSCALEBAR_LABEL_OFFSET
  if (availH <= 0 || arcsYDomainBp <= 0) {
    return undefined
  }
  const yScale = availH / arcsYDomainBp
  const step = niceStep(arcsYDomainBp)
  const anchor = pairedArcsDown
    ? arcsTop + YSCALEBAR_LABEL_OFFSET
    : arcsTop + arcsHeight - YSCALEBAR_LABEL_OFFSET

  const ticks: YScaleTicks['ticks'] = []
  for (let v = 0; v <= arcsYDomainBp; v += step) {
    const offset = Math.min(v * yScale, availH)
    const y = pairedArcsDown ? anchor + offset : anchor - offset
    ticks.push({ value: v, y, label: formatBp(v) })
  }

  const yTop = pairedArcsDown ? anchor : anchor - availH
  const yBottom = pairedArcsDown ? anchor + availH : anchor
  return { ticks, yTop, yBottom }
}
