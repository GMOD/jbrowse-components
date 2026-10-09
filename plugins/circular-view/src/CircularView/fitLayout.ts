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

/**
 * The ring at one scale: `basesPx` of bases and `units` inter-slice gaps. The
 * gaps take the declared spacing up to a quarter of the ring between them,
 * which keeps a small circle's chromosomes from drawing as ticks with holes
 * between them, and the radius is the one that closes the ring.
 */
export function ringAt(basesPx: number, units: number, spacingPx: number) {
  const spacing = units
    ? Math.min(
        spacingPx,
        (basesPx * maxSpacingFraction) / (units * (1 - maxSpacingFraction)),
      )
    : spacingPx
  return { spacingPx: spacing, radiusPx: (basesPx + units * spacing) / twoPi }
}

/**
 * The most bp per px the circle zooms out to: its bases alone fill the least
 * radius, so the ring, gaps and all, never closes below it.
 */
export function maxBpPerPxFor(totalBp: number, minimumRadiusPx: number) {
  return totalBp / (twoPi * minimumRadiusPx)
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
  /** the scale the circle fills the box at; undefined with no bases */
  bpPerPx: number | undefined
  radiusPx: number
  paddingPx: number
}

/**
 * The circle that fills the box: its scale and radius, and the padding the
 * view keeps at every zoom. A pure function of the regions and the box, so
 * nothing reads back a value derived from itself.
 *
 * At any one scale the rest follows: the regions elide, `ringAt` closes the
 * ring, and the padding holds the labels drawn there, measured as if every
 * one radiated outward, up to half the half-box, past which a label is
 * clipped rather than the circle crushed. The radius and the labels both
 * shrink as the scale grows, so the fit is the least scale whose circle and
 * padding fit the box, found by bisection; at a jump in the gap count it
 * takes the side that fits. Most steps elide what the last one did, so each
 * elision is measured once.
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
  const byMask = new Map<string, { units: number; paddingPx: number }>()
  const drawnAt = (mask: string) => {
    let drawn = byMask.get(mask)
    if (!drawn) {
      const elided = elideRegions(regions, mask)
      const needPx =
        maxLabelGutterPx(
          regions.length > 1
            ? [...elided.map(regionLabelText), ...elidedLabel]
            : [],
        ) + genomeBand
      drawn = {
        units: sum(gapUnitsAfter(elided)),
        paddingPx: Math.max(boxPadding, Math.min(needPx, halfBox / 2)),
      }
      byMask.set(mask, drawn)
    }
    return drawn
  }
  const layoutAt = (bpPerPx: number) => {
    const { units, paddingPx } = drawnAt(
      elisionMask(regions, bpPerPx, minVisibleWidth),
    )
    return {
      bpPerPx,
      radiusPx: ringAt(totalBp / bpPerPx, units, spacingPx).radiusPx,
      paddingPx,
    }
  }
  if (totalBp <= 0) {
    return { bpPerPx: undefined, radiusPx: 0, paddingPx: boxPadding }
  }
  const fits = (bpPerPx: number) => {
    const { radiusPx, paddingPx } = layoutAt(bpPerPx)
    return radiusPx + paddingPx <= halfBox
  }
  // a ring of no gaps as wide as the box is too big, and the circle zooms out
  // no further than its least radius
  let lo = totalBp / (twoPi * halfBox)
  let hi = maxBpPerPxFor(totalBp, input.minimumRadiusPx)
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
