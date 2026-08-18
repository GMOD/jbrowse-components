import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcColorByType } from '../../shared/types.ts'

// The shared vocabulary of the arc pass: the region lists it runs against, the
// settings that gate it, the pending form a read pair or split junction takes
// before coalescing, and the computed forms that come out. Split from
// `compute.ts` so the pass's stages (`arcColors`, `arcChains`,
// `arcClustering`, `arcRegions`) can each import the vocabulary without
// importing each other.
// Matches samplot.py --jitter const default (0.08). Applied multiplicatively
// to |tlen| so lines at the same insert size are visually separated.
export const CLOUD_JITTER_BOUNDS = 0.08

export interface RegionInfo {
  refName: string
  start: number
  end: number
  displayedRegionIndex: number
}

// The two region lists this pass needs, which are NOT the same list and are not
// interchangeable — hence one named object rather than two adjacent
// `RegionInfo[]` parameters nothing could tell apart.
//
// `loaded` is the fetch: `collectArcInputs` walks it to find the reads, and a
// region whose fetch has not landed has none. `displayed` is the VIEW's, and it
// is what a foot's region is resolved against, because the question
// `CrossRegionArc` asks is "can `view.bpToPx` project both feet" and that
// projector reads `displayedRegions`. Keying the partition on the loaded list
// instead leaves the original bug alive for a displayed-but-unfetched partner:
// the far foot resolves to no region, the arc falls into the within-region half,
// and `arcTouchesRegion` hands it to the near foot's block on a raw bp
// comparison — where it is extrapolated and clipped exactly as before.
export interface ArcRegions {
  loaded: RegionInfo[]
  displayed: RegionInfo[]
}

export interface ArcSettings {
  colorByType: ArcColorByType
  // read cloud mode: flat lines at Y=|tlen|, concordant FR pairs
  // filtered out so only discordant pairs remain. Coloring follows colorByType
  // (same palette as arcs), not a separate DEL/DUP/INV scheme.
  cloud?: boolean
  drawInter: boolean
  drawLongRange: boolean
  // Whether ordinary concordant pairs get an arc. Shares its definition of
  // "concordant" with the read filter behind "Show proper pairs"
  // (`isConcordantPairRead`). Defaults true — every arc drawn, as before the
  // setting existed.
  drawProperPairArcs?: boolean
  // Reads a translocation breakpoint must gather before its marks are drawn —
  // see `clusteredInterchromSupport`. 1 (or 0) draws every one, which is what
  // this did before the setting existed.
  //
  // MATE-LINK EVIDENCE ONLY (`clearsInterchromFloor`), and taken against the
  // number each mark actually draws with: a cluster's own size for an arc, the
  // coalesced total for a tick. Neither is a free choice — see `pushLine` for
  // why testing a tick's addends instead let a display setting change the count
  // the hover reported.
  minInterchromSupport?: number
  // See `CanonicalRefName`. Without it a split junction between a fetched read
  // (`1`) and its SA segment (`chr1`) reads as inter-chromosomal and paints as a
  // connector tick instead of the intra-chromosomal split-inversion arc.
  // Optional: omitted (tests / no assembly) means no aliasing — identity.
  canonicalRefName?: CanonicalRefName
}
export interface SegAln {
  refName: string
  start: number
  end: number
  strand: number
  // soft/hard-clip at the 5' start of the read — read-order sort key
  clipAtStart: number
  // present in the current view (a fetched pileup entry) vs. known only from a
  // sibling's SA tag (maps to a region no displayed region covers)
  onScreen: boolean
}

export interface ArcEndpoint {
  refName: string
  bp: number
}

export interface ComputedArc {
  p1: ArcEndpoint
  p2: ArcEndpoint
  colorType: number
  shapeType: number
  yBp: number
  // What the arc's Y MEANS, before the read cloud's jitter is folded into the
  // plotted `yBp`: |TLEN| for a mate link, the breakpoint gap for a split
  // junction, the genomic radius for a curved arc. The reported quantity, as
  // opposed to the drawn one — see `ArcsUploadData.arcSpanBp`.
  spanBp: number
  // The reads standing behind this arc. Always >= 1, and the number
  // `arcLineWidth` turns into a stroke width and the hover reports.
  //
  // HOW THEY ARE COUNTED DEPENDS ON THE FAMILY, because "reads that agree on
  // this junction" is not one measurement:
  //
  //   - Same-chromosome: the connections coalesced onto this exact coordinate
  //     (`resolveArcs`, keyed by `arcKey`). A split read knows its breakpoint to
  //     the base and a pair's endpoints are its own, so agreement IS coincidence
  //     and counting it is exact.
  //   - Interchromosomal: the size of its WINDOWED cluster
  //     (`clusteredInterchromSupport`). Mate-pair support for a translocation
  //     scatters over a fragment length rather than stacking on a base — 862 of
  //     865 connections were the sole occupant of their coordinate on HG002 300x
  //     — so the exact count reads 1 for essentially every one of them. It said
  //     "Supported by 1 read" over a hundred-pair translocation and drew it at
  //     a lone mismapping's weight: the whole channel this field exists to feed,
  //     reading empty in the family that needs it most.
  //
  // Not two meanings — one statement measured the way each family's evidence
  // actually distributes. The windowed count is already what
  // `minInterchromSupport` filters on, so the number drawn and the number
  // filtered are one number rather than two free to disagree.
  //
  // A tick is windowed too, and `pushLine` has the one difference: half a
  // junction can be reached by more than one cluster, so it sums them.
  support: number
  // The `arcKey` this arc was deduped under, so it is unique across the array.
  // Only `resolveArcs`' sort reads it, as the tie-break that makes paint order
  // independent of the order the reads arrived in.
  key: string
}

/**
 * An arc whose two feet are in DIFFERENT displayed regions, carrying the region
 * each foot resolved to.
 *
 * These are separated out because **no per-region pass can draw them**, and the
 * failure is not that they go missing. Both renderers map bp to x through the
 * block's own range — `bpToClipX` off `u.bpHi/bpLo/bpLen` on the GPU,
 * `bpToScreenX(bp, block, …)` on Canvas2D — and the GPU additionally draws into
 * a viewport that IS the block. So an arc with one foot outside gets its far
 * foot extrapolated at the block's own scale, which lands nowhere near where the
 * other block actually sits, and the scissor cuts what is left. Handed to both
 * regions, as it used to be, the reader gets TWO half-curves pointing at
 * nothing.
 *
 * Measured on the HG02768 inverted duplication with its window split into two
 * regions 300 bp apart: 52 of 381 arcs (13.6%) were cross-region, i.e. 104
 * dangling halves. The same view as one region, and the same two regions 2 Mb
 * apart, have none — a fragment can only straddle a seam, so this set is
 * inherently small and an overlay drawn once across the whole view can afford
 * to be SVG. That overlay is the same answer `bezierArcScope`'s `crossRegion`
 * already gives for the per-read connectors, and for the same reason.
 *
 * An interchromosomal arc is necessarily one of these — two refNames cannot
 * share a displayed region — and that is structural rather than incidental
 * because `resolveArcs` decides both from the SAME pair of region lookups. See
 * `groupArcsByRef`, which depends on it.
 */
export interface CrossRegionArc extends ComputedArc {
  p1RegionIndex: number
  p2RegionIndex: number
  // Which way the ARM this junction keeps runs from each foot, as a GENOMIC
  // direction (+1 toward higher coordinates, -1 toward lower). The breakend
  // orientation: outward feet are a deletion-type junction, inward a
  // duplication-type, parallel an inversion, and that grammar is the only thing
  // left saying it once `ARC_COLOR_INTERCHROM` has overwritten an
  // interchromosomal arc's colour. `screenFeet` (crossRegionOverlay.ts) is the
  // one consumer and says which arcs draw them.
  //
  // THE ARM, not "this segment's own aligned body", and the difference is what
  // the two producers have to be read against. They coincide for a split
  // junction, whose endpoint IS the junction — so `connectionEndpointBps` hands
  // its `dir1`/`dir2` straight through. They are OPPOSITE rays for a mate link,
  // whose endpoint is the fragment's outer edge with the read's body pointing
  // back at the junction from it; `pairOuterDir` negates for that reason and
  // carries the worked example.
  //
  // HERE rather than on `ComputedArc`, alongside the region indices and for the
  // same reason: the two are only ever read by the overlay. Nothing per-region
  // draws a foot — `ArcsUploadData` carries no per-foot direction and the GPU
  // pass would have to grow one — and a `ComputedLine` cannot have one at all,
  // since a tick coalesces on a single coordinate and two junctions sharing a
  // breakpoint would silently take whichever read arrived first.
  //
  // Safe on a COALESCED arc, which an arc here always is: the direction is a
  // property of the junction rather than of the read that crossed it — see
  // `readTrailingBodyDir`.
  p1Dir: number
  p2Dir: number
}

// A connector tick. No color: every tick is ARC_COLOR_INTERCHROM (see the
// interchromosomal branch of `resolveArcs` for why that isn't a setting). One
// per distinct breakpoint, not one per supporting read — see `resolveArcs`.
export interface ComputedLine {
  x: ArcEndpoint
  // Reads through this breakpoint, drawn the same way an arc's is:
  // `arcLineWidth` turns it into a stroke width in all three renderers. A
  // translocation carrying 40 reads and one carrying a single mismapped pair are
  // not the same claim, and until the ticks were coalesced there was nowhere for
  // that count to go.
  //
  // Counted the way half a junction has to be: the sum of the sizes of the
  // distinct windowed CLUSTERS reaching this coordinate, each contributing once.
  // `pushLine` has why neither the reads at the coordinate nor one cluster's own
  // size will do, and `ComputedArc.support` the whole-junction case beside it.
  //
  // INDEPENDENT OF `minInterchromSupport`, which is applied to this total rather
  // than to the clusters summed into it. A number that moved when the filter
  // moved was reporting the filter, not the reads.
  support: number
  // The refName(s) on the FAR side of this breakpoint, sorted and unique. The
  // one fact a tick is drawn to convey and the only one it could not answer: a
  // vertical line at a locus, with the chromosome it points at knowable only by
  // hovering a read underneath. Plural because a breakpoint in a complex
  // rearrangement genuinely reaches more than one chromosome, and collapsing
  // that to "the first one" would be a confident wrong answer.
  partnerRefNames: string[]
}

export interface PendingArcEndpoints {
  p1Ref: string
  p1Bp: number
  p1Strand: number
  // Genomic direction of the retained ARM at each foot — see
  // `CrossRegionArc.p1Dir`, which is where it ends up. Resolved by the producer
  // that chose the bp, never re-derived from the strand downstream: which edge
  // an endpoint IS decides it, the producers here choose different edges, and
  // the two that choose the fragment's outer edge answer this with the read's
  // direction NEGATED (`pairOuterDir`).
  p1Dir: number
  p2Ref: string
  p2Bp: number
  p2Strand: number
  p2Dir: number
}

// A split-read junction between two segments of a single read: it carries no
// pair orientation / template length (those are pair concepts), so a discriminated
// union on `isSplit` lets the non-split arm prove `pairOrientationNum`/`tlen`
// are present rather than coercing `undefined` away downstream.
export interface SplitPendingArc extends PendingArcEndpoints {
  isSplit: true
}

// A mate link between the two reads of a pair: sourced from the primary's
// orientation + template length.
export interface PairedPendingArc extends PendingArcEndpoints {
  isSplit: false
  pairOrientationNum: number
  tlen: number
  // SAM flags of the record the pair fields were sourced from, carried for
  // `isConcordantPairRead` alone — the aligner's own verdict on the pair, which
  // is what "Show concordant-pair arcs" hides. On the split arm there is nothing
  // to carry: a junction between two segments of one read has no pair to call
  // proper, which is the same reason `tlen` and the orientation live here.
  flags: number
}

export type PendingArc = SplitPendingArc | PairedPendingArc
// Carries `refName` — unlike the bezier overlay's entry — because this path
// compares a fetched segment against one named only by an SA tag or RNEXT, and
// same-chromosome-ness is the whole difference between an arc and a connector
// tick. That extra field is why the two paths build their own entries; the field
// ACCESSORS are shared (readGroupConnections), which is where the duplication
// that mattered was.
export interface ReadEntry {
  displayedRegionIndex: number
  refName: string
  readIdx: number
  data: WorkerPileupData
}
// Maps a raw BAM refName (SA tag / RNEXT — the file's own naming, e.g. `chr1`)
// to the assembly-canonical name the fetched reads carry (e.g. `1`). Keeping
// every SegAln/PendingArc refName canonical is what stops a same-chr split
// junction from reading as inter-chromosomal.
export type CanonicalRefName = (refName: string) => string

// Dependencies threaded through pending-arc EMISSION: the normalizer above plus
// the two user gates that decide whether a connection to a partner this view has
// not loaded is worth emitting at all.
//
// Chain BUILDING takes only the normalizer, which is why that is the narrower
// parameter below rather than this bundle. The gates decide whether a junction
// touching an off-screen segment is emitted as an arc; they say nothing about
// which segments a read has, so a chain builder handed this whole struct had to
// be given values for fields it could not read — and `computeReadChains` duly
// set `drawLongRange: true` under a comment explaining that nothing would look
// at it.
export interface ArcChainContext {
  drawLongRange: boolean
  drawInter: boolean
  canonicalRefName: CanonicalRefName
}
