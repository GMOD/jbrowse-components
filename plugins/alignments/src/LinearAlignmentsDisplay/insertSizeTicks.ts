import { ARC_HEIGHT_MARGIN } from './shaders/palettes.ts'
import { arcYFraction } from '../features/arcs/arcYScale.ts'

import type { ArcBand } from './renderers/rendererTypes.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Format bp values with a compact unit (matches the X-axis ruler style). Large
// kb/Mb values round to a whole number (e.g. 33950 → "34kb", not "34.0kb") since
// a fractional unit on a coarse insert-size tick reads as noise (reviewer).
function formatBp(v: number) {
  if (v === 0) {
    return '0'
  }
  if (v >= 1_000_000) {
    const mb = v / 1_000_000
    return `${mb >= 10 ? Math.round(mb) : mb % 1 === 0 ? mb : mb.toFixed(1)}Mb`
  }
  if (v >= 1000) {
    const kb = v / 1000
    return `${kb >= 10 ? Math.round(kb) : kb % 1 === 0 ? kb : kb.toFixed(1)}kb`
  }
  return `${Math.round(v)}bp`
}

// Decade log tick values (1, 10, 100, … powers of 10) within [1, domain], always
// ending at the domain max. Thinned to at most `maxTicks` (keeping the min and
// max) so a short band shows just a couple of readable ticks instead of a dense
// unreadable ladder — `maxTicks` is derived from the band height by the caller.
function logTickValues(domain: number, maxTicks: number) {
  const values: number[] = [1]
  for (let v = 10; v <= domain; v *= 10) {
    values.push(v)
  }
  if (values.at(-1) !== domain) {
    values.push(domain)
  }
  if (values.length <= maxTicks) {
    return values
  }
  // thin evenly across the decades, always keeping the first (min) and last (max)
  const step = (values.length - 1) / (maxTicks - 1)
  const out: number[] = []
  for (let i = 0; i < maxTicks; i++) {
    out.push(values[Math.round(i * step)]!)
  }
  return [...new Set(out)]
}

// Ruler for the read-cloud insert-size arcs. Geometry is derived from the same
// `ArcBand` + `ARC_HEIGHT_MARGIN` + `arcYFraction` the arcs themselves use (see
// features/arcs/drawCanvas.ts / arcYScale.ts), so a tick at insert size `v`
// lands exactly on the apex of the arc plotting that value — the two paths
// can't drift. Read cloud uses a base-2 log scale, so ticks are log-positioned.
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

  // ~30px of vertical room per tick keeps the 10px labels from colliding; a
  // short band (e.g. the read-cloud TLEN band) thus shows just min + max
  const maxTicks = Math.max(2, Math.floor(availH / 30))

  const items: YScaleTicks['items'] = []
  for (const v of logTickValues(arcsYDomainBp, maxTicks)) {
    const offset = Math.min(
      arcYFraction(v, arcsYDomainBp, true) * availH,
      availH,
    )
    const y = band.down ? anchor + offset : anchor - offset
    items.push({ value: v, y, label: formatBp(v) })
  }

  const yTop = band.down ? anchor : anchor - availH
  const yBottom = band.down ? anchor + availH : anchor
  return { items, yTop, yBottom }
}
