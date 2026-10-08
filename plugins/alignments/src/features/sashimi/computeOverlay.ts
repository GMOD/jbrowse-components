import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { measureText } from '@jbrowse/core/util'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { AlignmentFill } from '@jbrowse/core/ui/palette'

// A junction is tinted like the reads supporting it. The neutral is the theme's
// unpaired-read grey, resolved by each host from its own palette so the dark
// theme and a themed export both get theirs.
export function sashimiArcColor(
  strand: number,
  fill: Pick<AlignmentFill, 'pairLR'>,
) {
  return strand === 1
    ? colorFwdStrand
    : strand === -1
      ? colorRevStrand
      : fill.pairLR
}

// Owned here because `sashimiLabelSpanPx` and the apex clearance both depend on them.
export const SASHIMI_LABEL_FONT_SIZE = 9
export const SASHIMI_LABEL_HALO_WIDTH = 2.5

const MIN_LABEL_SPAN_PX = 22
const LABEL_PADDING_PX = 6

// The digit term: a 4-5 digit count on deep RNA-seq overflowed its arc under a
// flat 22px threshold.
export function sashimiLabelSpanPx(count: number) {
  return Math.max(
    MIN_LABEL_SPAN_PX,
    measureText(count, SASHIMI_LABEL_FONT_SIZE) + LABEL_PADDING_PX,
  )
}

// Room the count label needs past a down arc's apex. Only the down band pays
// it, because only the down band is clipped; an up arc's label draws into the
// histogram's scalebar margin. Charging the up band too took 16% off every arc
// in the default 45px coverage band to avoid a rare overlap with the axis text.
export const SASHIMI_APEX_CLEARANCE_PX =
  SASHIMI_LABEL_FONT_SIZE / 2 + SASHIMI_LABEL_HALO_WIDTH / 2

/**
 * One group's per-region sashimi arrays, restricted to the regions on screen,
 * tagged with each region's refName — what `mergeJunctions` takes.
 */
export function visibleRegionJunctions(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  visibleRegions: readonly {
    refName: string
    displayedRegionIndex: number
  }[],
) {
  return visibleRegions.flatMap(region => {
    const data = rpcDataMap.get(region.displayedRegionIndex)
    return data && data.sashimiX1.length > 0
      ? [{ refName: region.refName, data }]
      : []
  })
}
