import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { ConnectionFilter } from '../../shared/types.ts'
import type { AdapterRefName } from '@jbrowse/core/util'

// The shared vocabulary of the arc pass, kept apart from `compute.ts` so its
// stages can import it without importing each other.
// samplot.py's --jitter default; multiplies |tlen| so equal inserts separate.
export const CLOUD_JITTER_BOUNDS = 0.08

export interface RegionInfo {
  refName: string
  start: number
  end: number
  displayedRegionIndex: number
}

// The two region lists the pass needs, which are not interchangeable. `loaded`
// is the fetch: `collectArcInputs` walks it for reads. `displayed` is the
// view's, and a foot's region is resolved against it because `CrossRegionArc`
// asks whether `view.bpToPx` can project both feet, which reads
// `displayedRegions`. Resolving against the loaded list instead files an arc
// with a displayed-but-unfetched partner into the near foot's block, where its
// far foot is extrapolated and clipped.
export interface ArcRegions {
  loaded: RegionInfo[]
  displayed: RegionInfo[]
}

/** Whether the band draws its ordinary pairs: as written, else arcs do and the cloud doesn't. */
export function ordinaryPairsShown(
  setting: boolean | undefined,
  cloud: boolean,
) {
  return setting ?? !cloud
}

export interface ArcSettings {
  // Read cloud mode: flat lines at Y=|tlen| showing discordant pairs, colored
  // as the arcs are.
  cloud?: boolean
  // `minInterchromReads` gates interchromosomal mate-link evidence only
  // (`clearsInterchromFloor`), against the number each mark draws with: a
  // cluster's size for an arc, the coalesced total for a tick (see `pushLine`).
  filter?: Partial<ConnectionFilter>
  // Whether the band draws its ordinary pairs: concordant flags for arcs
  // (`isConcordantPairRead`, shared with `svSignal`), a modal |TLEN| for the
  // cloud. Unset is `ordinaryPairsShown`'s.
  showOrdinaryPairs?: boolean
  // See `CanonicalRefName`. Omitted means identity.
  canonicalRefName?: CanonicalRefName
}
export interface SegAln {
  refName: string
  start: number
  end: number
  strand: number
  // soft/hard-clip at the 5' start of the read — read-order sort key
  clipAtStart: number
  // a fetched pileup entry, as opposed to one known only from a sibling's SA tag
  onScreen: boolean
  // above MAPQ 0, as ADR-229 counts a piece placed
  placed: boolean
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
  // The arc's reported Y before the read cloud's jitter: |TLEN| for a mate
  // link, the breakpoint gap for a split junction, the genomic radius for a
  // curved arc. See `ArcsUploadData.arcSpanBp`.
  spanBp: number
  // The reads standing behind this arc, always >= 1: the number
  // `arcStrokeScale` draws and the hover reports. A same-chromosome arc counts
  // the connections coalesced onto its exact `arcKey`, since a split read knows
  // its breakpoint to the base and a pair's endpoints are its own. An
  // interchromosomal arc counts its windowed cluster
  // (`clusteredInterchromSupport`), since mate pairs scatter over a fragment
  // length rather than stacking on a base (DEEP_COVERAGE.md); that is also the
  // number `minInterchromReads` filters on, so drawn and filtered agree. A tick
  // is windowed too, but sums every cluster reaching it (`pushLine`).
  support: number
  // The `arcKey` this arc was deduped under, unique across the array; the paint
  // sort's tie-break, independent of read arrival order.
  key: string
}

/**
 * An arc whose two feet are in different displayed regions, carrying the region
 * each foot resolved to.
 *
 * No per-region pass can draw one: both renderers map bp to x through the
 * block's own range and the GPU draws into a viewport that is the block, so a
 * foot outside it is extrapolated at the wrong scale and scissored. These are
 * drawn once across the whole view instead, as an SVG overlay; a fragment can
 * only straddle a seam, so the set is small.
 *
 * An interchromosomal arc is always one of these, because two refNames cannot
 * share a displayed region and `resolveArcs` decides both from one pair of
 * region lookups. `groupArcsByRef` depends on it.
 */
export interface CrossRegionArc extends ComputedArc {
  p1RegionIndex: number
  p2RegionIndex: number
  // The genomic direction (+1 toward higher coordinates, -1 lower) of the arm
  // this junction keeps, from each foot: the breakend orientation, the only
  // thing still saying it once `ARC_COLOR_INTERCHROM` has replaced the color.
  // It is the arm, not the segment's own aligned body: the two coincide for a
  // split junction (`connectionEndpointBps`' `dir1`/`dir2`) and are opposite
  // for a mate link, whose endpoint is the fragment's outer edge
  // (`pairOuterDir`). Only the overlay reads it (`buildArcBandFeeds`), which is
  // why it lives here and not on `ComputedArc` or `ComputedLine`. A property of
  // the junction, so safe on a coalesced arc (`readTrailingBodyDir`).
  p1Dir: number
  p2Dir: number
}

// One far-side landing site of a tick's reads: the position the first read of
// a windowed cluster reached, and the cluster's size.
export interface PartnerLocus {
  refName: string
  bp: number
  support: number
}

// A connector tick, one per distinct breakpoint. No color: every tick is
// ARC_COLOR_INTERCHROM.
export interface ComputedLine {
  x: ArcEndpoint
  // Reads through this breakpoint, drawn through `arcStrokeScale` like an
  // arc's: the sum of the sizes of the distinct windowed clusters reaching this
  // coordinate, each once. `pushLine` has why, and `ComputedArc.support` the
  // whole-junction case. Independent of `minInterchromReads`, which is applied
  // to this total rather than to its addends.
  support: number
  // The refNames on the far side of this breakpoint, sorted and unique; plural
  // because a breakpoint in a complex rearrangement can reach several.
  partnerRefNames: string[]
  // Where those reads land, one entry per cluster summed into `support`, most
  // reads first.
  partnerLoci: PartnerLocus[]
}

export interface PendingArcEndpoints {
  p1Ref: string
  p1Bp: number
  p1Strand: number
  // Genomic direction of the retained arm at each foot (`CrossRegionArc.p1Dir`).
  // Set by the producer that chose the bp and never re-derived from the strand,
  // since which edge an endpoint is decides it (`pairOuterDir`).
  p1Dir: number
  p2Ref: string
  p2Bp: number
  p2Strand: number
  p2Dir: number
  // Whether the connection reaches a partner this view has not loaded
  // (`offScreenMateArcs`, a split junction touching an off-screen segment): the
  // `offscreenMates` category on the same chromosome.
  offScreen?: boolean
}

// A split-read junction between two segments of one read. It has no pair
// orientation or template length, so the union on `isSplit` lets the paired
// arm prove `pairOrientationNum`/`tlen` are present.
export interface SplitPendingArc extends PendingArcEndpoints {
  isSplit: true
}

// A mate link between the two reads of a pair, with the primary's orientation
// and template length.
export interface PairedPendingArc extends PendingArcEndpoints {
  isSplit: false
  pairOrientationNum: number
  tlen: number
  // The mates lie on two chromosomes by the record's RNEXT (`readInterchrom`),
  // whether or not the two drawn ends do: a translocated mate's supplementary
  // can sit beside its partner.
  interchrom: boolean
  // SAM flags of the record the pair fields came from, for
  // `isConcordantPairRead`, which "Ordinary pairs" hides by.
  flags: number
  // The insert-size band of the region `tlen` came from, which fills the read
  // under the arc; each region's fetch samples its own.
  stats: InsertSizeBand | undefined
  // The clip before each end's 5' edge, which with the edge and strand is the
  // unclipped 5' position a PCR or optical copy reproduces (`fragmentEndsKey`).
  // `MATE_CLIP_UNKNOWN` for a mate known only from PNEXT.
  p1Clip: number
  p2Clip: number
}

export type PendingArc = SplitPendingArc | PairedPendingArc

export const MATE_CLIP_UNKNOWN = -1

/**
 * What a copy of this connection's fragment shares with it: both ends' edges,
 * strands and clips, in an order-free form, since which end of a copy was read
 * first is chance. Asked only where connections already coincide (a cluster, a
 * coalesced arc), so the hot collection loop builds none. A split junction is
 * never a copy: reads agreeing on it to the base are its evidence.
 */
export function fragmentEndsKey(arc: PendingArc, index: number) {
  return arc.isSplit
    ? `split\0${index}`
    : orderFree(
        `${arc.p1Ref}\0${arc.p1Bp}\0${arc.p1Strand}\0${arc.p1Clip}`,
        `${arc.p2Ref}\0${arc.p2Bp}\0${arc.p2Strand}\0${arc.p2Clip}`,
      )
}

function orderFree(a: string, b: string) {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`
}
// Carries `refName`, unlike the connector mark's entry, because same-chromosome
// against an SA tag or RNEXT is what separates an arc from a tick. The field
// accessors are shared (readGroupConnections).
export interface ReadEntry {
  displayedRegionIndex: number
  refName: string
  readIdx: number
  data: WorkerPileupData
  // The display lane this record was fetched into, '' for one lane. On the
  // record because grouped rendering chains every lane's reads under one QNAME,
  // and an arc's lane is the fragment's primary's.
  groupKey: string
}
// Maps a raw BAM refName (SA tag / RNEXT, e.g. `chr1`) to the assembly-canonical
// name the fetched reads carry (e.g. `1`). Keeping every SegAln/PendingArc
// refName canonical stops a same-chromosome split junction reading as
// inter-chromosomal.
export type CanonicalRefName = (refName: AdapterRefName) => string

// What pending-arc emission takes: the normalizer plus the two filter
// categories that decide whether a connection to an unloaded partner is
// emitted. Chain building takes only the normalizer.
export interface ArcChainContext {
  filter: Pick<Partial<ConnectionFilter>, 'interchrom' | 'offscreenMates'>
  canonicalRefName: CanonicalRefName
}
