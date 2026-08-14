import {
  colorFwdStrand,
  colorNostrand,
  colorRevStrand,
} from '@jbrowse/core/ui/palette'

import { sashimiArcGeometry, sortArcsByScore } from './arcGeometry.ts'
import { mergeJunctions } from './junctions.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { SashimiArc } from './arcGeometry.ts'
import type { SashimiSide } from './junctions.ts'

// Splice-junction (sashimi) arcs: the coverage pipeline's `skip` gaps, merged
// across regions and projected to screen space. Both the on-screen
// `SashimiArcsOverlay` (which adds hover/click handlers) and the SVG export
// (which serializes static <path>s) consume this output.
//
// Sashimi stays rendered as vector SVG by design — arc counts are low, vector
// performance is fine, and SVG paths give native hover/tooltip behavior.
// Keeping the geometry computation shared prevents the on-screen and export
// paths from drifting (e.g. cubic vs quadratic Bezier, different palettes); the
// geometry itself now lives one file over in `arcGeometry.ts`, shared with the
// split-read junction arcs that draw into the same two bands.

export interface ComputeSashimiArcsOpts {
  rpcDataMap: ReadonlyMap<number, PileupDataResult>
  visibleRegions: {
    refName: string
    displayedRegionIndex: number
  }[]
  bpToScreenX: (refName: string, bp: number) => number | undefined
  coverageHeight: number
  sashimiArcsHeight: number
  minSashimiScore: number
  // Which junctions draw in the strip below coverage, by `junctionKey`. Decided
  // once per group in `junctions.ts` from the loaded data, so the strip the
  // layout reserved and the arcs drawn into it are the same decision — see that
  // module's header for why this isn't recomputed here in screen space.
  downJunctionKeys: ReadonlySet<string>
}

// Sashimi arcs reuse the read-alignment strand colors (theme.ts) so a junction
// is tinted the same as the reads supporting it. Opaque hex (not rgba/alpha):
// the arc strokes are thin and the count label carries its own halo, so they
// stay legible over the coverage histogram, and plain 6-digit hex serializes
// into the SVG export with the widest tool compatibility.
function getArcColor(strand: number) {
  return strand === 1
    ? colorFwdStrand
    : strand === -1
      ? colorRevStrand
      : colorNostrand
}

export function computeSashimiArcs(opts: ComputeSashimiArcsOpts): SashimiArc[] {
  const {
    rpcDataMap,
    visibleRegions,
    bpToScreenX,
    coverageHeight,
    sashimiArcsHeight,
    minSashimiScore,
    downJunctionKeys,
  } = opts
  const heights = { coverageHeight, sashimiArcsHeight }

  // `mergeJunctions` collapses the copies the per-region worker emits of one
  // junction (see junctions.ts) — the same merge, on the same keys, the layout's
  // side assignment ran on. Only the visible regions contribute: a junction that
  // just scrolled off has no business drawing at the edge it left behind.
  const merged = mergeJunctions(
    visibleRegions.flatMap(region => {
      const data = rpcDataMap.get(region.displayedRegionIndex)
      return data && data.sashimiX1.length > 0
        ? [{ refName: region.refName, data }]
        : []
    }),
    minSashimiScore,
  )

  // The overlay/export place each side in the matching SVG, so `d` is
  // band-local.
  const arcs: SashimiArc[] = []
  for (const j of merged.values()) {
    const x1 = bpToScreenX(j.refName, j.start)
    const x2 = bpToScreenX(j.refName, j.end)
    // A coordinate inside a collapsed intron is in no displayed region at all,
    // so it has no pixel to hang from and the whole arc is dropped rather than
    // drawn against a clamped edge that asserts a splice site not on screen.
    if (x1 === undefined || x2 === undefined) {
      continue
    }
    // Junctions the layout never saw can't exist (it merges the loaded regions,
    // a superset of the visible ones), but 'up' is the side that needs no
    // reserved strip, so it is also the safe answer if one ever did.
    const side: SashimiSide = downJunctionKeys.has(j.key) ? 'down' : 'up'
    arcs.push({
      ...sashimiArcGeometry({
        x1,
        x2,
        genomicSpan: Math.abs(j.end - j.start),
        count: j.count,
        side,
        heights,
      }),
      stroke: getArcColor(j.strand),
      start: j.start,
      end: j.end,
      refName: j.refName,
      // A skip gap is one CIGAR operation inside one alignment, so both ends are
      // on the read's own reference by construction — there is no splice
      // junction across two chromosomes to represent.
      endRefName: j.refName,
      score: j.count,
      strand: j.strand,
      title: 'Intron/Skip',
    })
  }

  return sortArcsByScore(arcs)
}
