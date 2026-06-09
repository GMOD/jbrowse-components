import { niceStep } from '@jbrowse/alignments-core'

import { ARC_HEIGHT_MARGIN } from './shaders/palettes.ts'

import type { ArcBand } from './renderers/rendererTypes.ts'
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

// Ruler for the samplot insert-size arcs. Geometry is derived from the same
// `ArcBand` + `ARC_HEIGHT_MARGIN` the arcs themselves use (see
// features/arcs/drawCanvas.ts), so a tick at insert size `v` lands exactly on
// the apex of the arc plotting that value — the two paths can't drift.
// Anchor (insert size 0): band top in down mode (ticks descend), band bottom in
// up mode (ticks ascend).
export function computeInsertSizeTicks({
  band,
  arcsYDomainBp,
}: {
  band: ArcBand
  arcsYDomainBp: number
}): YScaleTicks | undefined {
  const availH = band.height - ARC_HEIGHT_MARGIN
  if (availH <= 0 || arcsYDomainBp <= 0) {
    return undefined
  }
  const anchor = band.down ? band.top : band.top + band.height
  const yScale = availH / arcsYDomainBp
  const step = niceStep(arcsYDomainBp)

  const items: YScaleTicks['items'] = []
  for (let v = 0; v <= arcsYDomainBp; v += step) {
    const offset = Math.min(v * yScale, availH)
    const y = band.down ? anchor + offset : anchor - offset
    items.push({ value: v, y, label: formatBp(v) })
  }

  const yTop = band.down ? anchor : anchor - availH
  const yBottom = band.down ? anchor + availH : anchor
  return { items, yTop, yBottom }
}
