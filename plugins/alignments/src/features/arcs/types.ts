// Worker → main-thread payload for paired-end / split-read arcs and the
// interchromosomal connector ticks. Owned by the arcs feature.
export interface ArcsUploadData {
  arcX1: Uint32Array
  arcX2: Uint32Array
  arcColorTypes: Uint8Array
  arcShapeTypes: Uint8Array
  arcYBp: Uint32Array
  // What each arc's Y means, as opposed to where it draws. The read cloud
  // multiplies `arcYBp` by a deterministic ±8% jitter so coincident pairs
  // separate visually, so `arcYBp` is a position and this is the quantity —
  // |TLEN| for a mate link, the breakpoint gap for a split junction. Nothing
  // draws from it and no GPU pass packs it; it is what the hover reports, which
  // read the jittered value and named it the insert size.
  arcSpanBp: Uint32Array
  // Reads supporting each arc: how many identical connections `resolveArcs`
  // folded into it, always >= 1. The three draw paths turn it into stroke width
  // through `arcLineWidth` — none of them may re-derive that curve.
  arcSupport: Uint32Array
  numArcs: number
  // How many of `numArcs` are flat (read-cloud) shapes, and the largest insert
  // size among them. Both precomputed in the pass that builds the arrays, so the
  // `arcsYDomainBp` view reduces over regions rather than over every arc and
  // `packArcMarkers` sizes its buffer exactly — in arc mode the count is 0 and
  // the whole endpoint-marker pass is skipped.
  numFlatArcs: number
  // The max `arcSpanBp`, NOT the max `arcYBp` it used to be. This is what the
  // read cloud's Y axis autoscales to and therefore what its top tick is
  // LABELLED, so a domain taken off the drawn position carried the ±8% jitter
  // into the ruler: a view whose largest insert is 10.0 kb printed "11kb" at the
  // top of its axis, reproducibly, since the factor is a hash of the endpoints.
  // Same defect the hover had before it started reporting `spanBp`.
  //
  // Arcs jittered ABOVE the domain then clamp to `availH` instead of separating,
  // which is the whole cost and it is sub-pixel: on a log axis 8% over a 10 kb
  // domain is log2(1.08)/log2(10000) — 0.8% of a band tens of px tall.
  maxFlatArcSpanBp: number
  // One entry per connector tick (interchromosomal breakpoint marker). The tick
  // spans the full arc band, so no Y is stored, and every tick is
  // ARC_COLOR_INTERCHROM, so no color is stored either — see arcLine.slang.
  arcLinePositions: Uint32Array
  // Reads behind each tick, the same channel `arcSupport` is for arcs: stroke
  // width through `arcLineWidth`, and the number the hover reports.
  arcLineSupport: Uint32Array
  // The far-side refName(s) of each tick, sorted and unique — the fact the
  // hover exists to give, since a tick's own position says only where the
  // breakpoint is and not what it reaches. A `string[][]` beside the typed
  // arrays because this feed is built and consumed entirely on the main thread
  // (`computeArcsByGroup` runs in the model, not the worker); only
  // `arcLinePositions` and the widths derived here cross into a GPU buffer.
  arcLinePartnerRefNames: string[][]
  numArcLines: number
}

// Whether one region's feed paints anything in the arc band — EITHER family.
// Named once because the two counts are asked together everywhere and asking
// only `numArcs` is a live bug rather than a style point: a lane whose only
// interchromosomal partner is off-region carries ticks and no arcs, and gating
// on the arc count reserves the band, paints the ticks, and then treats the
// band as empty.
export function hasArcBandInk(data: ArcsUploadData) {
  return data.numArcs > 0 || data.numArcLines > 0
}

// "Does this LANE paint anything" used to live here too, as `anyArcsDrawn` over
// one group's region map. It moved into `computeArcsByGroup` as `inkGroupKeys`
// when the cross-region arcs were split out, because the question stopped being
// answerable from this feed alone: a lane whose every arc crosses a seam has
// all its ink in the overlay and none in any region's `ArcsUploadData`, and the
// old predicate said the band was empty and reserved no strip for it.

export function emptyArcsUploadData(): ArcsUploadData {
  return {
    arcX1: new Uint32Array(0),
    arcX2: new Uint32Array(0),
    arcColorTypes: new Uint8Array(0),
    arcShapeTypes: new Uint8Array(0),
    arcYBp: new Uint32Array(0),
    arcSpanBp: new Uint32Array(0),
    arcSupport: new Uint32Array(0),
    numArcs: 0,
    numFlatArcs: 0,
    maxFlatArcSpanBp: 0,
    arcLinePositions: new Uint32Array(0),
    arcLineSupport: new Uint32Array(0),
    arcLinePartnerRefNames: [],
    numArcLines: 0,
  }
}
