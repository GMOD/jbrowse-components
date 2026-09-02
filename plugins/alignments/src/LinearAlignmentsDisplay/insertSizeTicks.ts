import {
  arcAnchorY,
  arcAvailH,
  arcMarkY,
  arcYFraction,
  arcYOffsetPx,
} from '../features/arcs/arcYScale.ts'

import type { ArcBand } from './renderers/rendererTypes.ts'
import type { YScaleTicks } from '@jbrowse/wiggle-core'

// Format bp values with a compact unit (matches the X-axis ruler style). Large
// kb/Mb values round to a whole number (e.g. 33950 → "34kb", not "34.0kb") since
// a fractional unit on a coarse insert-size tick reads as noise (reviewer).
function formatBp(v: number) {
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
  const decades = [1]
  for (let v = 10; v <= domain; v *= 10) {
    decades.push(v)
  }
  if (decades.at(-1) !== domain) {
    decades.push(domain)
    // The appended max lands wherever the data put it, which is often a hair
    // above the decade below it — and on a LOG axis "a hair above" is a hair
    // apart. `arcsYDomainBp` is a real maximum |TLEN|, so any library topping
    // out just past a power of ten hits this: at domain 1005 in a 160px band the
    // 1000 and 1005 ticks came out 0.1px apart, printing "1kb" over "1.0kb"; at
    // 10500 in a 200px band, 1.1px apart; at 12000, 3.9px.
    //
    // The thinning below cannot reach it — it fires only when there are MORE
    // decades than slots, and it keeps the first and last, which are the two in
    // question here. So the crowded decade is dropped up front, on the same
    // budget the caller sized `maxTicks` with: one tick per `1/maxTicks` of the
    // axis, which is where its `availH / 30` came from. The MAX is the one kept
    // — it is the top of the axis and the number the domain is.
    const crowded = decades.at(-2)
    if (
      decades.length > 2 &&
      crowded !== undefined &&
      // `arcYFraction`, not a second spelling of log2/log2 beside it: this
      // decides a tick's fate on where that tick would LAND, so it has to be
      // the function that lands it.
      arcYFraction(crowded, domain, true) > 1 - 1 / maxTicks
    ) {
      decades.splice(-2, 1)
    }
  }
  if (decades.length <= maxTicks) {
    return decades
  }
  // Thin evenly across the decades, always keeping the first (min) and last
  // (max): `i = maxTicks - 1` rounds to exactly `decades.length - 1`. Getting
  // here means `decades.length > maxTicks >= 2`, so `step > 1` and consecutive
  // `i` land on distinct indices — no value is emitted twice, which matters
  // because YScaleBar and CrossHatchLines both key on `${value}-${y}`.
  const step = (decades.length - 1) / (maxTicks - 1)
  return Array.from(
    { length: maxTicks },
    (_, i) => decades[Math.round(i * step)]!,
  )
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
  const availH = arcAvailH(band.height)
  if (availH <= 0 || arcsYDomainBp <= 0) {
    return undefined
  }
  const anchor = arcAnchorY(band.top, band.height, band.down)

  // ~30px of vertical room per tick keeps the 10px labels from colliding; a
  // short band (e.g. the read-cloud TLEN band) thus shows just min + max
  const maxTicks = Math.max(2, Math.floor(availH / 30))

  const items: YScaleTicks['items'] = []
  for (const v of logTickValues(arcsYDomainBp, maxTicks)) {
    const offset = arcYOffsetPx(v, arcsYDomainBp, true, availH)
    items.push({
      value: v,
      y: arcMarkY(anchor, offset, band.down),
      label: formatBp(v),
    })
  }

  // Down mode anchors insert size 0 at the band TOP, so the pair comes back
  // reversed: `yTop` carries the domain min there and `yBottom` the max.
  const yTop = band.down ? anchor : anchor - availH
  const yBottom = band.down ? anchor + availH : anchor
  return { items, yTop, yBottom }
}
