import { sum } from '@jbrowse/core/util'

import {
  assemblyBandPx,
  maxLabelGutterPx,
  regionLabelText,
} from './rulerLabels.ts'
import { GENOME_GAP_UNITS } from './slices.ts'

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

// How many inter-slice gaps go round the circle at this scale: one per slice,
// plus the extra at each genome boundary. Elision only merges regions within
// an assembly, so the boundaries are the regions' own whatever the scale.
function gapUnitsAt(
  regions: readonly Region[],
  bpPerPx: number,
  minVisibleWidth: number,
) {
  let slices = 0
  let boundaries = 0
  let runAssembly: string | undefined
  regions.forEach((region, i) => {
    const next = regions[(i + 1) % regions.length]!
    if (next.assemblyName !== region.assemblyName) {
      boundaries++
    }
    if ((region.end - region.start) / bpPerPx >= minVisibleWidth) {
      slices++
      runAssembly = undefined
    } else if (runAssembly !== region.assemblyName) {
      slices++
      runAssembly = region.assemblyName
    }
  })
  return slices + (GENOME_GAP_UNITS - 1) * boundaries
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

function spacingFor(spacingPx: number, radiusPx: number, units: number) {
  return units
    ? Math.min(spacingPx, (twoPi * radiusPx * maxSpacingFraction) / units)
    : spacingPx
}

// The scale at which the regions and their gaps go exactly once round a circle
// of `radiusPx`. The ring's length falls as the scale grows, since the bases
// take fewer pixels and elision only removes gaps, so there is one crossing;
// bisection finds it where a gap count jumps, and settles on the side whose
// ring fits.
function scaleFor(
  regions: readonly Region[],
  totalBp: number,
  radiusPx: number,
  spacingPx: number,
  minVisibleWidth: number,
) {
  const target = twoPi * radiusPx
  const ringPx = (bpPerPx: number) => {
    const units = gapUnitsAt(regions, bpPerPx, minVisibleWidth)
    return totalBp / bpPerPx + units * spacingFor(spacingPx, radiusPx, units)
  }
  // the gaps take at most a quarter of the ring, so the answer is between the
  // scale with no gaps and the scale with a quarter of it gaps
  let lo = totalBp / target
  let hi = totalBp / (target * (1 - maxSpacingFraction))
  for (let i = 0; i < 60 && hi - lo > lo * 1e-12; i++) {
    const mid = Math.sqrt(lo * hi)
    if (ringPx(mid) > target) {
      lo = mid
    } else {
      hi = mid
    }
  }
  // with the gap count there, the crossing solves exactly, unless it sits
  // on the jump itself
  const units = gapUnitsAt(regions, hi, minVisibleWidth)
  const exact =
    totalBp / (target - units * spacingFor(spacingPx, radiusPx, units))
  return gapUnitsAt(regions, exact, minVisibleWidth) === units ? exact : hi
}

/**
 * The circle that fills the box: its scale, radius, and the padding and
 * spacing the view keeps at every zoom. A pure function of the regions and the
 * box, so nothing reads back a value derived from itself.
 *
 * The padding holds the labels drawn at the fitted scale, measured as if every
 * one radiated outward, and an elision's `[N]` at its longest, so a zoom out
 * that turns them radial or elides more never outgrows it. It starts at the
 * box's share; where the labels at that fit need more, the fit is redone at
 * what they need, up to half the half-box, past which a label is clipped
 * rather than the circle crushed. That smaller circle only elides more, which
 * only drops labels, so it needs no more room than the first pass found.
 */
export function fitLayout(input: FitInput): FitLayout {
  const { regions, width, height, spacingPx, paddingPx, minVisibleWidth } =
    input
  const halfBox = Math.min(width, height) / 2
  const totalBp = sum(regions.map(r => r.end - r.start))
  const genomeBand =
    new Set(regions.map(r => r.assemblyName)).size > 1 ? assemblyBandPx : 0
  const elidedLabel = regions.length > 1 ? [`[${regions.length}]`] : []
  const fitAt = (padding: number) => {
    const radiusPx = Math.max(halfBox - padding, input.minimumRadiusPx)
    const bpPerPx =
      totalBp > 0
        ? scaleFor(regions, totalBp, radiusPx, spacingPx, minVisibleWidth)
        : undefined
    const labels =
      bpPerPx === undefined
        ? []
        : elideRegions(
            regions,
            elisionMask(regions, bpPerPx, minVisibleWidth),
          ).map(regionLabelText)
    return {
      radiusPx,
      bpPerPx,
      needPx: maxLabelGutterPx([...labels, ...elidedLabel]) + genomeBand,
    }
  }
  const boxPadding = Math.min(
    paddingPx,
    Math.max(minPaddingPx, halfBox * maxPaddingFraction),
  )
  const first = fitAt(boxPadding)
  const paddingOut = Math.max(boxPadding, Math.min(first.needPx, halfBox / 2))
  const { radiusPx, bpPerPx } =
    paddingOut > boxPadding ? fitAt(paddingOut) : first
  const units =
    bpPerPx === undefined
      ? regions.length
      : gapUnitsAt(regions, bpPerPx, minVisibleWidth)
  return {
    bpPerPx,
    radiusPx,
    paddingPx: paddingOut,
    spacingPx: spacingFor(spacingPx, radiusPx, units),
  }
}
