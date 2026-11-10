import { getOrCreate } from '../../shared/util.ts'
import { plotsOnInsertSizeAxis } from './shapes.ts'

import type {
  ComputedArc,
  ComputedLine,
  PartnerLocus,
  RegionInfo,
} from './arcTypes.ts'
import type { ArcsUploadData } from './types.ts'

// Partitioning computed arcs onto displayed regions after `resolveArcs`, and
// materializing each region's upload arrays: no GPU pass joins two regions.

// Which displayed region a genomic point falls in, or undefined. First match
// wins where regions overlap in bp, the same tie `makeBpToScreenX` breaks.
export function regionIndexOf(
  regions: RegionInfo[],
  refName: string,
  bp: number,
) {
  for (const r of regions) {
    if (r.refName === refName && bp >= r.start && bp <= r.end) {
      return r.displayedRegionIndex
    }
  }
  return undefined
}

// How far outside the fetched data the read cloud still draws a bar toward:
// `CLOUD_OFFSCREEN_REACH` times the span this fetch pulled, so a real event
// just past the window edge keeps its bars and the reach follows the zoom. On
// HG002 300x (47 20 kb windows, 5,281 cloud arcs) a reach under 14x admits only
// singletons and past ~50x the uniform mismapping tail; 20x sits inside that
// band, with a worst-case domain of 590 kb against a median of 2 kb.
export const CLOUD_OFFSCREEN_REACH = 20

export function cloudReachBp(loadedRegions: RegionInfo[]) {
  let loadedBp = 0
  for (const r of loadedRegions) {
    loadedBp += r.end - r.start
  }
  return CLOUD_OFFSCREEN_REACH * loadedBp
}

// Whether a foot is close enough to the fetched data for a bar toward it to
// mean something: `regionIndexOf`'s question widened by `cloudReachBp`. A
// boolean, not a widened `regionIndexOf`, because the region an arc is
// partitioned into must be one that can project the foot.
export function nearLoadedRegion(
  regions: RegionInfo[],
  refName: string,
  bp: number,
  reachBp: number,
) {
  return regions.some(
    r =>
      r.refName === refName && bp >= r.start - reachBp && bp <= r.end + reachBp,
  )
}

function bucketByRef<T>(items: T[], refOf: (item: T) => string) {
  const byRef = new Map<string, T[]>()
  for (const item of items) {
    getOrCreate(byRef, refOf(item), () => []).push(item)
  }
  return byRef
}

// Group computed arcs and lines by refName for O(1) per-region lookup. Keyed on
// `p1` alone, and `arcTouchesRegion` tests no refName, which is safe only
// because `resolveArcs` sends every arc whose feet resolve to two displayed
// regions to `crossRegion`, from the same two lookups that make the
// interchromosomal arc/tick choice. An interchromosomal arc reaching here would
// be projected at a garbage x. `compute.test.ts` pins the invariant.
export function groupArcsByRef(arcs: ComputedArc[], lines: ComputedLine[]) {
  return {
    arcsByRef: bucketByRef(arcs, arc => arc.p1.refName),
    linesByRef: bucketByRef(lines, line => line.x.refName),
  }
}

// Whether an arc's span crosses one region: the last resort `arcOwner` files
// an arc under when neither foot lies in a loaded region. Every mark's extent
// is the span between its feet, so an arc with both feet on one side draws
// nothing here. An arc whose every endpoint is off-screen reaches no region, so
// it neither uploads nor sizes `maxFlatArcSpanBp`.
export function arcTouchesRegion(arc: ComputedArc, region: RegionInfo) {
  const { bp: b1 } = arc.p1
  const { bp: b2 } = arc.p2
  return Math.min(b1, b2) <= region.end && Math.max(b1, b2) >= region.start
}

// A connector tick is a single bp with no horizontal extent beyond its own
// stroke, so it belongs to the region containing it and to no other.
export function lineTouchesRegion(line: ComputedLine, region: RegionInfo) {
  return line.x.bp >= region.start && line.x.bp <= region.end
}

export function arcsToRegionResult(
  regionArcs: ComputedArc[],
  regionLines: ComputedLine[],
): ArcsUploadData {
  const arcX1 = new Uint32Array(regionArcs.length)
  const arcX2 = new Uint32Array(regionArcs.length)
  const arcColorTypes = new Uint8Array(regionArcs.length)
  const arcShapeTypes = new Uint8Array(regionArcs.length)
  const arcYBp = new Uint32Array(regionArcs.length)
  const arcSpanBp = new Uint32Array(regionArcs.length)
  const arcSupport = new Uint32Array(regionArcs.length)

  // The reported span, not the jittered `yBp`: the cloud's Y axis autoscales to
  // and labels its top tick with this.
  let maxFlatArcSpanBp = 0
  for (let i = 0; i < regionArcs.length; i++) {
    const arc = regionArcs[i]!
    arcX1[i] = arc.p1.bp
    arcX2[i] = arc.p2.bp
    arcColorTypes[i] = arc.colorType
    arcShapeTypes[i] = arc.shapeType
    arcYBp[i] = arc.yBp
    arcSpanBp[i] = arc.spanBp
    arcSupport[i] = arc.support
    // Not `isFlatArcShape`: an unplaced bar is drawn at the anchor because its
    // span has no place on the axis (reference/LINEAR_ALIGNMENTS_DISPLAY.md).
    if (plotsOnInsertSizeAxis(arc.shapeType) && arc.spanBp > maxFlatArcSpanBp) {
      maxFlatArcSpanBp = arc.spanBp
    }
  }

  const arcLinePositions = new Uint32Array(regionLines.length)
  const arcLineSupport = new Uint32Array(regionLines.length)
  const arcLinePartnerRefNames: string[][] = []
  const arcLinePartnerLoci: PartnerLocus[][] = []
  for (let i = 0; i < regionLines.length; i++) {
    const line = regionLines[i]!
    arcLinePositions[i] = line.x.bp
    arcLineSupport[i] = line.support
    arcLinePartnerRefNames.push(line.partnerRefNames)
    arcLinePartnerLoci.push(line.partnerLoci)
  }

  return {
    arcX1,
    arcX2,
    arcColorTypes,
    arcShapeTypes,
    arcYBp,
    arcSpanBp,
    arcSupport,
    numArcs: regionArcs.length,
    maxFlatArcSpanBp,
    arcLinePositions,
    arcLineSupport,
    arcLinePartnerRefNames,
    arcLinePartnerLoci,
    numArcLines: regionLines.length,
  }
}

// One group's computed arcs and ticks as each loaded region's
// `ArcsUploadData`, every arc filed under one region (`arcOwner`).
export function arcsToRegionMap(
  { arcs, lines }: { arcs: ComputedArc[]; lines: ComputedLine[] },
  regions: RegionInfo[],
): Map<number, ArcsUploadData> {
  const { arcsByRef, linesByRef } = groupArcsByRef(arcs, lines)
  const arcsByRegion = new Map<number, ComputedArc[]>()
  for (const [refName, refArcs] of arcsByRef) {
    const onRef = regions.filter(r => r.refName === refName)
    for (const arc of refArcs) {
      const owner = arcOwner(arc, onRef)
      if (owner) {
        getOrCreate(arcsByRegion, owner.displayedRegionIndex, () => []).push(
          arc,
        )
      }
    }
  }
  const out = new Map<number, ArcsUploadData>()
  for (const ri of regions) {
    out.set(
      ri.displayedRegionIndex,
      arcsToRegionResult(
        arcsByRegion.get(ri.displayedRegionIndex) ?? [],
        (linesByRef.get(ri.refName) ?? []).filter(l =>
          lineTouchesRegion(l, ri),
        ),
      ),
    )
  }
  return out
}

// The one loaded region an arc draws from, since the band draws each arc
// once across the whole view: the one holding its first foot, else its
// second, else the first its span crosses.
function arcOwner(arc: ComputedArc, onRef: RegionInfo[]) {
  const holds = (bp: number) => onRef.find(r => bp >= r.start && bp <= r.end)
  return (
    holds(arc.p1.bp) ??
    holds(arc.p2.bp) ??
    onRef.find(r => arcTouchesRegion(arc, r))
  )
}
