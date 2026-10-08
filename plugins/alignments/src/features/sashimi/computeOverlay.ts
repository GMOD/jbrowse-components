import { colorFwdStrand, colorRevStrand } from '@jbrowse/core/ui/palette'
import { measureText } from '@jbrowse/core/util'
import { YSCALEBAR_LABEL_OFFSET } from '@jbrowse/wiggle-core/constants'

import { sashimiArcHeightFraction } from './bandFeed.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { SashimiSide } from './bandFeed.ts'
import type { MergedJunction } from './junctions.ts'
import type { AlignmentFill } from '@jbrowse/core/ui/palette'

/** A junction's read count, placed at its arc's apex in its side's band. */
export interface SashimiLabel {
  key: string
  x: number
  y: number
  count: number
}

export type SashimiLabelsBySide = Record<SashimiSide, SashimiLabel[]>

// Every field here moves during a gesture; the merge's inputs do not.
export interface ProjectSashimiLabelsOpts {
  bpToScreenX: (refName: string, bp: number) => number | undefined
  // the box both hosts draw into, so the cull cannot drop a label either shows
  viewWidthPx: number
  coverageHeight: number
  sashimiArcsHeight: number
  // by `junctionKey`, decided in `junctions.ts` from the loaded data so the
  // strip the layout reserved and the arcs drawn into it are one decision
  downJunctionKeys: ReadonlySet<string>
}

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

// Owned here because `labelSpanPx` and the apex clearance both depend on them.
export const SASHIMI_LABEL_FONT_SIZE = 9
export const SASHIMI_LABEL_HALO_WIDTH = 2.5

const MIN_LABEL_SPAN_PX = 22
const LABEL_PADDING_PX = 6

// The digit term: a 4-5 digit count on deep RNA-seq overflowed its arc under a
// flat 22px threshold.
function labelSpanPx(count: number) {
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

// Band-local geometry per side. Both bands floor at 0, since nothing floors a
// config-declared height.
function bandGeometry(
  side: SashimiSide,
  heights: { effectiveHeight: number; sashimiArcsHeight: number },
) {
  return side === 'down'
    ? {
        band: Math.max(
          0,
          heights.sashimiArcsHeight - SASHIMI_APEX_CLEARANCE_PX,
        ),
        baseline: 0,
        dir: 1,
      }
    : {
        band: heights.effectiveHeight,
        baseline: heights.effectiveHeight,
        dir: -1,
      }
}

/**
 * The frame-owed half of the count labels: merged junctions in, each side's
 * labels out in band-local px, at the apex the side's mark draws
 * (`sashimiBandsOf`). An arc too narrow on screen for its count gets none.
 */
export function projectSashimiLabels(
  merged: Iterable<MergedJunction>,
  opts: ProjectSashimiLabelsOpts,
): SashimiLabelsBySide {
  const {
    bpToScreenX,
    viewWidthPx,
    coverageHeight,
    sashimiArcsHeight,
    downJunctionKeys,
  } = opts
  // Up arcs hang off the histogram's zero line, one scalebar offset above the
  // band bottom; the overlay already places the band at the histogram top, a
  // second offset down.
  const effectiveHeight = Math.max(
    0,
    coverageHeight - 2 * YSCALEBAR_LABEL_OFFSET,
  )
  const out: SashimiLabelsBySide = { up: [], down: [] }
  for (const j of merged) {
    const x1 = bpToScreenX(j.refName, j.start)
    const x2 = bpToScreenX(j.refName, j.end)
    // an end inside a collapsed intron has no pixel to hang from
    if (x1 !== undefined && x2 !== undefined) {
      const x = (x1 + x2) / 2
      if (
        Math.abs(x2 - x1) >= labelSpanPx(j.count) &&
        x >= 0 &&
        x <= viewWidthPx
      ) {
        const side = downJunctionKeys.has(j.key) ? 'down' : 'up'
        const { band, baseline, dir } = bandGeometry(side, {
          effectiveHeight,
          sashimiArcsHeight,
        })
        // a band with no height draws no arc for a count to stand on
        if (band > 0) {
          out[side].push({
            key: j.key,
            x,
            y:
              baseline +
              dir * band * sashimiArcHeightFraction(Math.abs(j.end - j.start)),
            count: j.count,
          })
        }
      }
    }
  }
  return out
}

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
