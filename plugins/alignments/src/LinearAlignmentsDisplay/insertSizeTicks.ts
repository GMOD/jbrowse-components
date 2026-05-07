import { YSCALEBAR_LABEL_OFFSET, niceStep } from '@jbrowse/alignments-core'

import type { YScaleTicks } from '@jbrowse/wiggle-core'

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

// Y=0 (insert size 0) at the arc anchors; max at apex.
// pairedArcsDown: anchor at top, ticks descend. !pairedArcsDown: anchor at bottom, ticks ascend.
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
