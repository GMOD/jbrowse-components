import { SCALE_TYPE_LOG } from '@jbrowse/render-core/scoreScale'
import { pointRowYPx, pointYPx } from '@jbrowse/render-core/shaders/pointMark'

import { ARC_BAND_INSET_PX } from './renderers/arcMarks.ts'

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
      Math.log2(crowded) / Math.log2(Math.max(2, domain)) > 1 - 1 / maxTicks
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

// Where the band's marks plot insert size `v`: the read cloud's log y scale,
// the one `arcBandYScale` gives the bars and the endpoint squares.
function bandY(band: ArcBand, domainMax: number, v: number) {
  return pointRowYPx(
    band.top,
    band.height,
    band.down ? 1 : 0,
    pointYPx(
      v,
      1,
      domainMax,
      band.height,
      SCALE_TYPE_LOG,
      ARC_BAND_INSET_PX,
      1,
    ),
  )
}

// Ruler for the read cloud's insert sizes, placed through the same scale the
// bars are (`bandY`), so a tick at `v` lies on the bars plotting it.
export function computeInsertSizeTicks({
  band,
  arcsYDomainBp,
}: {
  band: ArcBand
  arcsYDomainBp: number
}): YScaleTicks | undefined {
  const plotH = band.height - 2 * ARC_BAND_INSET_PX
  if (plotH <= 0 || arcsYDomainBp <= 0) {
    return undefined
  }
  const domainMax = Math.max(2, arcsYDomainBp)
  // ~30px of vertical room per tick keeps the 10px labels from colliding; a
  // short band thus shows just min + max
  const maxTicks = Math.max(2, Math.floor(plotH / 30))
  const items: YScaleTicks['items'] = logTickValues(
    arcsYDomainBp,
    maxTicks,
  ).map(v => ({ value: v, y: bandY(band, domainMax, v), label: formatBp(v) }))
  const yMin = bandY(band, domainMax, 1)
  const yMax = bandY(band, domainMax, domainMax)
  return {
    items,
    yTop: Math.min(yMin, yMax),
    yBottom: Math.max(yMin, yMax),
  }
}
