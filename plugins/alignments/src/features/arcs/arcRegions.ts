import { getOrCreate } from '../../shared/util.ts'
import { isFlatArcShape, plotsOnInsertSizeAxis } from './shapes.ts'

import type { ComputedArc, ComputedLine, RegionInfo } from './arcTypes.ts'
import type { ArcsUploadData } from './types.ts'

// Partitioning computed arcs onto displayed regions, and materializing each
// region's upload arrays.

// Kept apart from `compute.ts`: everything here runs AFTER `resolveArcs` has
// decided what the arcs are, and asks only where they go. No GPU pass can join
// two displayed regions, so this is where one buffer per region comes from.

// Which displayed region a genomic point falls in, or undefined for a point no
// region shows. First match wins: two displayed regions may overlap in bp (the
// same locus shown twice, a foldback laid out in derivative order), and an
// arbitrary-but-consistent answer beats none — `makeBpToScreenX` breaks the same
// tie the same way, by preferring the index it is given and falling back to the
// first match.
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

// How far outside the fetched data the read cloud will still draw a bar toward,
// in bp: `CLOUD_OFFSCREEN_REACH` times the span this fetch actually pulled.
//
// A bar to a partner the view has no data for is a line to nowhere, which is why
// the cloud has a reach at all. But the strict test — the partner must be IN a
// loaded region — throws away the case the band is most worth looking at: a real
// event just past the edge of the window, whose pairs all agree on one span and
// so draw one clean row. Those pairs point at something; a mate the aligner
// dropped at a random spot on the chromosome does not.
//
// RELATIVE TO WHAT IS LOADED, so the picture follows the view: zoom out and a
// farther event comes into reach, exactly as its arc would come back on screen.
//
// The multiple is measured, on HG002 300x (`NHGRI_Illumina300X_AJtrio`, hs37d5)
// over 47 20 kb windows across chr1, 2, 5, 11, 17 and 20 — 5,281 cloud arcs.
// Sweeping the reach and splitting what each newly admits into clustered
// evidence (three or more pairs agreeing on the junction within a fragment
// length) and singletons:
//
// ```
// reach   | newly drawn | of those, clustered | median domain | max domain
// 8x      |     5       |   0                 |  1 kb         |  238 kb
// 13x     |     8       |   0                 |  1 kb         |  354 kb
// 14x     |    55       |  46 (84%)           |  1 kb         |  409 kb
// 20x     |    58       |  46 (79%)           |  2 kb         |  590 kb
// 50x     |    63       |  46 (73%)           |  2 kb         |  1.1 Mb
// 1000x   |   261       | 101 (39%)           | 17.6 Mb       | 29.5 Mb
// ```
//
// Under 14x the reach buys nothing but singletons; past ~50x it starts admitting
// the uniform mismapping tail and the axis goes with it. Anywhere in between
// behaves alike, and 20x is inside that band rather than on its lower edge —
// which is set by a single 409 kb cluster, and sitting on it would be fitting
// the constant to one event. The cost is bounded by the same table: a worst-case
// domain of 590 kb against a median of 2 kb.
//
// It is often a no-op, which is the point. The 200 kb window at 1:2,000,000 —
// the one whose 96 screen-wide bars are the mass this whole rule exists for —
// holds no arc at all between 10 kb and 1 Mb, so nothing there is within reach
// and the picture is the strict one.
export const CLOUD_OFFSCREEN_REACH = 20

export function cloudReachBp(loadedRegions: RegionInfo[]) {
  let loadedBp = 0
  for (const r of loadedRegions) {
    loadedBp += r.end - r.start
  }
  return CLOUD_OFFSCREEN_REACH * loadedBp
}

// Whether a foot is close enough to the fetched data for a bar drawn toward it
// to mean something — `regionIndexOf`'s question, widened by `cloudReachBp`.
//
// A boolean rather than an index, and deliberately NOT a widened
// `regionIndexOf`: the region an arc is PARTITIONED into has to be one that can
// project the foot, so widening the lookup every caller shares would file a
// cross-region arc into a per-region buffer. This answers only "is there
// something over there", which is a different question from "where does this
// draw".
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

// Group computed arcs and lines by the refName they belong to so callers
// can look up the per-region subset in O(1) instead of filtering the full
// array once per displayed region.
//
// Keyed on `p1` alone, and `arcTouchesRegion` below compares raw bp with no
// refName test at all. Both are safe because of WHERE the arcs reaching here
// come from, not because an arc cannot span two chromosomes: `resolveArcs` sends
// every arc whose feet resolve to two different displayed regions to
// `crossRegion` instead, and two refNames cannot share a displayed region. So a
// two-refName arc is excluded by the region partition, one decision earlier and
// from the same two lookups the interchromosomal arc/tick choice is made from —
// which is why that partition has to stay a single decision point. An
// interchromosomal arc that did reach here would be bucketed under one
// chromosome and then projected at a garbage x inside it, silently.
// `compute.test.ts` pins the invariant rather than the reasoning.
export function groupArcsByRef(arcs: ComputedArc[], lines: ComputedLine[]) {
  return {
    arcsByRef: bucketByRef(arcs, arc => arc.p1.refName),
    linesByRef: bucketByRef(lines, line => line.x.refName),
  }
}

// Whether an arc can paint any ink inside one region's block, which is the
// question "does this arc belong in that region's buffer" — refName equality is
// only half of it.
//
// A mark's horizontal extent is the span between its two feet: a dome runs foot
// to foot, a far pair's legs rise AT the feet, and a flat read-cloud bar lies
// between them. So an arc with both feet outside the region on the same side
// draws nothing in it. The block is inside the loaded region by construction —
// `isBlockCovered` is what gates rendering on exactly that — so measuring
// against the region is the conservative form of measuring against the block.
//
// Without this, every displayed region on a chromosome received every arc on
// that chromosome. Harmless to look at (the far copies project off-block and the
// scissor eats them) and not free: it multiplied the pack, the upload and the
// per-mousemove `hitTestArcBand` walk by the number of same-ref regions. That is
// the multi-region SV view, which is what read connections are for.
//
// An arc reaching NO region is one whose every endpoint is off-screen — the
// junction between two off-screen SA segments of one read, which `drawLongRange`
// admits and which used to be uploaded everywhere and clipped away everywhere.
// It now reaches nothing, which also takes it out of `maxFlatArcSpanBp`: an arc
// that cannot be drawn no longer sizes the read cloud's shared Y axis.
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

  let numFlatArcs = 0
  // The reported span, not the drawn `yBp`: the read cloud's Y axis autoscales
  // to this and its top tick is labelled with it, so taking it off the jittered
  // position printed a template length no read has. See `maxFlatArcSpanBp`.
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
    if (isFlatArcShape(arc.shapeType)) {
      numFlatArcs++
    }
    // NOT the same predicate one line up, and the display's CLAUDE.md says why
    // the two questions look like one. Every flat variant is packed and drawn
    // as a bar with endpoint squares; only the two ON the axis may size it. A
    // parked pair (`ARC_SHAPE_FLAT_OFF_AXIS`) is drawn at the anchor precisely
    // because its span has no place on the axis, so letting that span set the
    // domain would be the failure parking exists to fix, arriving one step later.
    if (plotsOnInsertSizeAxis(arc.shapeType) && arc.spanBp > maxFlatArcSpanBp) {
      maxFlatArcSpanBp = arc.spanBp
    }
  }

  // One entry per connector tick — the arcLine pass self-expands each instance
  // to the two band-edge vertices (see arcLine.slang / packInstances).
  const arcLinePositions = new Uint32Array(regionLines.length)
  const arcLineSupport = new Uint32Array(regionLines.length)
  const arcLinePartnerRefNames: string[][] = []
  for (let i = 0; i < regionLines.length; i++) {
    const line = regionLines[i]!
    arcLinePositions[i] = line.x.bp
    arcLineSupport[i] = line.support
    arcLinePartnerRefNames.push(line.partnerRefNames)
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
    numFlatArcs,
    maxFlatArcSpanBp,
    arcLinePositions,
    arcLineSupport,
    arcLinePartnerRefNames,
    numArcLines: regionLines.length,
  }
}

// Bucket one group's computed arcs by refName, narrow each bucket to the region
// actually asking, then materialize that region's `ArcsUploadData`.
//
// TWO steps, not one, because the refName bucket is a Map lookup that skips
// every other chromosome's arcs outright while the bp narrowing is a scan of
// what survives it. Regions may overlap in bp and an arc spanning two of them
// belongs to both, so the second step is a per-region filter rather than a
// second bucketing — see `arcTouchesRegion`.
export function arcsToRegionMap(
  { arcs, lines }: { arcs: ComputedArc[]; lines: ComputedLine[] },
  regions: RegionInfo[],
): Map<number, ArcsUploadData> {
  const { arcsByRef, linesByRef } = groupArcsByRef(arcs, lines)
  const out = new Map<number, ArcsUploadData>()
  for (const ri of regions) {
    out.set(
      ri.displayedRegionIndex,
      arcsToRegionResult(
        (arcsByRef.get(ri.refName) ?? []).filter(a => arcTouchesRegion(a, ri)),
        (linesByRef.get(ri.refName) ?? []).filter(l =>
          lineTouchesRegion(l, ri),
        ),
      ),
    )
  }
  return out
}
