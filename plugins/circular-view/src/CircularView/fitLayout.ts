import { sum } from '@jbrowse/core/util'

import {
  assemblyBandPx,
  maxLabelGutterPx,
  regionLabelText,
} from './rulerLabels.ts'
import { gapUnitsAfter } from './slices.ts'

import type { SliceRegion } from './slices.ts'
import type { Region } from '@jbrowse/core/util'

const twoPi = 2 * Math.PI

// The declared padding and spacing are pixel counts sized for a circle with a
// window to itself. Past these shares of a smaller box they are capped, so the
// circle keeps one shape at every size: the SV inspector's circle gets about a
// third of the width, and at the declared values its disc covered 41% of its
// area and its gaps took half the ring. 0.2 is what the declared 80px already
// is at the 800px size it was tuned against.
const minPaddingPx = 20
const maxPaddingFraction = 0.2
const maxSpacingFraction = 0.25

/** One character per region: '1' where it is too narrow to draw as itself. */
export function elisionMask(
  regions: readonly Region[],
  bpPerPx: number,
  minVisibleWidth: number,
) {
  let mask = ''
  for (const region of regions) {
    mask += (region.end - region.start) / bpPerPx < minVisibleWidth ? '1' : '0'
  }
  return mask
}

/**
 * The regions as the circle draws them: each run of masked regions within one
 * assembly becomes one elided slice, and a lone masked region draws as itself.
 */
export function elideRegions(regions: readonly Region[], mask: string) {
  const out: SliceRegion[] = []
  regions.forEach((region, i) => {
    const widthBp = region.end - region.start
    const last = out.at(-1)
    if (mask[i] !== '1') {
      out.push({ ...region, widthBp, elided: false })
    } else if (
      last?.elided &&
      last.regions[0]!.assemblyName === region.assemblyName
    ) {
      last.regions.push({ ...region })
      last.widthBp += widthBp
    } else {
      out.push({ elided: true, widthBp, regions: [{ ...region }] })
    }
  })
  return out.map(r =>
    r.elided && r.regions.length === 1
      ? { ...r.regions[0]!, widthBp: r.widthBp, elided: false as const }
      : r,
  )
}

export interface FitInput {
  regions: readonly Region[]
  width: number
  height: number
  spacingPx: number
  paddingPx: number
  minVisibleWidth: number
  minimumRadiusPx: number
}

export interface FitLayout {
  /** the scale the regions close the ring at; undefined with no bases */
  bpPerPx: number | undefined
  radiusPx: number
  paddingPx: number
  spacingPx: number
}

/**
 * The circle that fills the box: its scale, radius, and the padding and
 * spacing the view keeps at every zoom. A pure function of the regions and the
 * box, so nothing reads back a value derived from itself.
 *
 * At any one scale the rest follows: the regions elide, the ring closes on the
 * radius its bases and gaps need, the gaps capped at a quarter of it, and the
 * padding holds the labels drawn there, measured as if every one radiated
 * outward, up to half the half-box, past which a label is clipped rather than
 * the circle crushed. The radius and the labels both shrink as the scale
 * grows, so the fit is the least scale whose circle and padding fit the box,
 * found by bisection; at a jump in the gap count it takes the side that fits.
 */
export function fitLayout(input: FitInput): FitLayout {
  const { regions, width, height, spacingPx, minVisibleWidth } = input
  const halfBox = Math.min(width, height) / 2
  const totalBp = sum(regions.map(r => r.end - r.start))
  const genomeBand =
    new Set(regions.map(r => r.assemblyName)).size > 1 ? assemblyBandPx : 0
  const elidedLabel =
    regions.length > 1
      ? [
          regionLabelText({
            elided: true,
            widthBp: totalBp,
            regions: [...regions],
          }),
        ]
      : []
  const boxPadding = Math.min(
    input.paddingPx,
    Math.max(minPaddingPx, halfBox * maxPaddingFraction),
  )
  const layoutAt = (bpPerPx: number) => {
    const drawn = elideRegions(
      regions,
      elisionMask(regions, bpPerPx, minVisibleWidth),
    )
    const units = sum(gapUnitsAfter(drawn))
    const basesPx = totalBp / bpPerPx
    const radiusPx = Math.max(
      Math.min(
        basesPx + units * spacingPx,
        basesPx / (1 - maxSpacingFraction),
      ) / twoPi,
      input.minimumRadiusPx,
    )
    const needPx =
      maxLabelGutterPx([...drawn.map(regionLabelText), ...elidedLabel]) +
      genomeBand
    return {
      bpPerPx,
      radiusPx,
      paddingPx: Math.max(boxPadding, Math.min(needPx, halfBox / 2)),
      spacingPx: spacingFor(spacingPx, radiusPx, units),
    }
  }
  if (totalBp <= 0) {
    return { ...layoutAt(1), bpPerPx: undefined }
  }
  const fits = (bpPerPx: number) => {
    const { radiusPx, paddingPx } = layoutAt(bpPerPx)
    return radiusPx + paddingPx <= halfBox
  }
  // a ring of no gaps as wide as the box is too big, and one squeezed to the
  // least radius with a quarter of it gaps is as small as the circle draws
  let lo = totalBp / (twoPi * halfBox)
  let hi = totalBp / (twoPi * input.minimumRadiusPx * (1 - maxSpacingFraction))
  if (!fits(hi)) {
    return layoutAt(hi)
  }
  for (let i = 0; i < 60 && hi - lo > lo * 1e-12; i++) {
    const mid = Math.sqrt(lo * hi)
    if (fits(mid)) {
      hi = mid
    } else {
      lo = mid
    }
  }
  return layoutAt(hi)
}

function spacingFor(spacingPx: number, radiusPx: number, units: number) {
  return units
    ? Math.min(spacingPx, (twoPi * radiusPx * maxSpacingFraction) / units)
    : spacingPx
}
