import { isConcordantPairRead } from '@jbrowse/alignments-core'
import { adapterRefNameText } from '@jbrowse/core/util'

import { passesCategory } from '../../shared/readCategoryFilters.ts'
import {
  collectPendingArcs,
  collectPendingArcsByLane,
  insertSizeStatsOf,
  groupLaneReadsByName,
  groupReadsByName,
} from './arcChains.ts'
import {
  DEFAULT_INTERCHROM_WINDOW_BP,
  arcKey,
  clearsInterchromFloor,
  clusteredInterchromSupport,
} from './arcClustering.ts'
import {
  ARC_COLOR_INTERCHROM,
  arcPaintOrder,
  arcPaintRank,
  getArcColorType,
  isConcordantFRPair,
} from './arcColors.ts'
import {
  arcsToRegionMap,
  cloudReachBp,
  nearLoadedRegion,
  regionIndexOf,
} from './arcRegions.ts'
import {
  CLOUD_JITTER_BOUNDS,
  fragmentEndsKey,
  ordinaryPairsShown,
} from './arcTypes.ts'
import {
  ARC_SHAPE_ARC,
  ARC_SHAPE_FLAT,
  ARC_SHAPE_FLAT_SPLIT,
  ARC_SHAPE_FLAT_UNPLACED,
  plotsOnInsertSizeAxis,
} from './shapes.ts'
import { hasArcBandInk } from './types.ts'

import type { WorkerPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { InterchromClusters } from './arcClustering.ts'
import type {
  ArcChainContext,
  ArcRegions,
  ArcSettings,
  ComputedArc,
  ComputedLine,
  CrossRegionArc,
  PendingArc,
  RegionInfo,
} from './arcTypes.ts'
import type { ArcsUploadData } from './types.ts'

// Nothing is re-exported from here: consumers import the module that defines
// what they want, so the render path does not pull in read grouping.

// Deterministic 0..1 hash of a junction's endpoints, a stable cloud jitter
// regardless of fetch or render order.
function pairJitter01(aBp: number, bBp: number) {
  // Order-normalized inside the hash so mate order cannot split one junction
  // into two Y offsets, and two `arcKey`s.
  const p1Bp = Math.min(aBp, bBp)
  const p2Bp = Math.max(aBp, bBp)
  // Math.imul keeps each product 32-bit; a plain `*` exceeds 2^53 at genomic
  // coordinates and loses the low bits.
  const seed = (Math.imul(p1Bp, 374761393) + Math.imul(p2Bp, 668265263)) >>> 0
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

// The shape and target Y (bp) of one arc. Arc mode: the curved ARC shape at
// the genomic radius. Read cloud: a flat line at the span with
// `CLOUD_JITTER_BOUNDS` jitter, the span being |tlen| for a mate link and the
// full breakpoint gap for a split junction or an unset TLEN of 0, so a split
// SV sits at the same ruler height as an equal-span discordant pair.
//
// A cloud connection the view can place only one end of leaves the axis
// (ARC_SHAPE_FLAT_UNPLACED at `yBp` 0): with no second pixel to draw to, its bar
// runs off screen and its span sets `arcsYDomainBp` for every lane. This is a
// placement test, not a span threshold: a pair 5 Mb apart with both ends in
// view belongs on the axis, and one 30 kb apart in a 20 kb window does not
// (ARC_BAND.md).
function computeArcShape({
  cloud,
  arc,
  absrad,
  placed,
}: {
  cloud: boolean
  arc: PendingArc
  absrad: number
  // Whether both feet are near a loaded region (`nearLoadedRegion`).
  placed: boolean
}) {
  const { p1Bp, p2Bp } = arc
  if (cloud) {
    const gapBp = Math.abs(p2Bp - p1Bp)
    const spanBp = arc.isSplit ? gapBp : Math.abs(arc.tlen) || gapBp
    if (!placed) {
      // No jitter on the anchor row; `spanBp` keeps the distance for the hover.
      return { shapeType: ARC_SHAPE_FLAT_UNPLACED, yBp: 0, spanBp }
    }
    const jitter = 1 + CLOUD_JITTER_BOUNDS * (pairJitter01(p1Bp, p2Bp) * 2 - 1)
    return {
      shapeType: arc.isSplit ? ARC_SHAPE_FLAT_SPLIT : ARC_SHAPE_FLAT,
      yBp: Math.round(spanBp * jitter),
      // Unjittered, for anything that reports a number rather than a position.
      spanBp,
    }
  }
  return { shapeType: ARC_SHAPE_ARC, yBp: absrad, spanBp: absrad }
}

// One group's pending arcs and the insert-size band its scale is built from.
interface ArcInputs {
  pendingArcs: PendingArc[]
  stats: InsertSizeBand | undefined
}

// The filter and refName normalizer pending-arc emission takes, built in one
// place so both entry points hand the chainer the same.
function arcChainContext(settings: ArcCollectionSettings): ArcChainContext {
  return {
    filter: settings.filter ?? {},
    canonicalRefName: settings.canonicalRefName ?? adapterRefNameText,
  }
}

function collectArcInputs(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  regions: RegionInfo[],
  settings: ArcSettings,
): ArcInputs {
  const readsByName = groupReadsByName(rpcDataMap, regions, '')
  const pendingArcs = collectPendingArcs(readsByName, arcChainContext(settings))
  return { pendingArcs, stats: insertSizeStatsOf(rpcDataMap) }
}

// What is pooled across the whole fetched read set rather than per group.
// `stats` sizes only the interchromosomal clustering window; an arc's insert
// class reads its own region's band (`arc.stats`).
export interface ArcScale {
  stats: InsertSizeBand | undefined
}

function poolArcScale(inputs: ArcScale[]): ArcScale {
  return { stats: inputs.find(i => i.stats !== undefined)?.stats }
}

// Color and shape one group's connections, coalescing those that would draw
// as the same arc (`arcKey`) so support becomes a channel (`arcStrokeScale`).
//
// Three outputs (arcs, cross-region arcs, ticks) from one region lookup per
// connection. Partitioning in a second pass would repeat the lookup, and "an
// interchromosomal arc is always cross-region" would hold only while the two
// agreed; `groupArcsByRef` and `arcTouchesRegion` rely on it.
function resolveArcs(
  pendingArcs: PendingArc[],
  settings: ArcSettings,
  regions: ArcRegions,
  { clusterOf, sizeOf }: InterchromClusters,
) {
  const { displayed: displayedRegions, loaded: loadedRegions } = regions
  // Describes the view, not a connection, so resolved once (`cloudReachBp`).
  const reachBp = cloudReachBp(loadedRegions)
  const { cloud = false, filter = {} } = settings
  const { minInterchromReads = 1 } = filter
  const showOrdinaryPairs = ordinaryPairsShown(
    settings.showOrdinaryPairs,
    cloud,
  )
  const arcs: ComputedArc[] = []
  const crossRegion: CrossRegionArc[] = []
  // One map over both `arcs` and `crossRegion`: a later `support++` mutates
  // the object already pushed to one of them.
  const byKey = new Map<string, ComputedArc>()
  // The fragments behind each arc, so a PCR or optical copy adds no support
  // (`fragmentEndsKey`). Built only once a second connection reaches a key.
  const firstAt = new Map<string, number>()
  const fragmentsAt = new Map<string, Set<string>>()
  function addsFragment(key: string, index: number) {
    const first = firstAt.get(key)!
    const fragments =
      fragmentsAt.get(key) ??
      new Set([fragmentEndsKey(pendingArcs[first]!, first)])
    const fragment = fragmentEndsKey(pendingArcs[index]!, index)
    const added = !fragments.has(fragment)
    fragments.add(fragment)
    fragmentsAt.set(key, fragments)
    return added
  }
  // Each tick with the coalescing's bookkeeping: the clusters already counted
  // into it and whether any is exempt from the floor (`pushLine`).
  const byLineKey = new Map<
    string,
    {
      line: ComputedLine
      clusters: Set<number>
      exempt: boolean
    }
  >()

  // One tick per breakend, a coordinate and the side it keeps, coalescing the
  // reads that agree on it as `arcKey` does for arcs, so support becomes a
  // channel and the hover has a count.
  //
  // Its support is the sum of the distinct clusters reaching this breakend,
  // each once. The connections at the coordinate would read 1 for nearly every
  // mate pair, since mates straddle a breakpoint; one cluster's size would
  // undercount two events sharing a base, the shape `partnerRefNames` is plural
  // for. Both coordinates of one event report the whole event, as an arc does.
  //
  // `minInterchromReads` is applied to the sum after coalescing, not to each
  // addend: gating the addends made the reported count follow the setting, and
  // dropped two reads at one breakpoint whose partners landed apart as two
  // clusters of 1.
  function pushLine(
    refName: string,
    bp: number,
    dir: number,
    partnerRef: string,
    partnerBp: number,
    cluster: number,
    clusterSupport: number,
    // Exempt from the floor (`clearsInterchromFloor`); one exempt cluster
    // keeps the tick whatever the sum.
    exempt: boolean,
  ) {
    const key = `${refName}\0${bp}\0${dir}`
    const seen = byLineKey.get(key)
    const locus = {
      refName: partnerRef,
      bp: partnerBp,
      support: clusterSupport,
    }
    if (seen) {
      if (!seen.clusters.has(cluster)) {
        seen.clusters.add(cluster)
        seen.line.support += clusterSupport
        seen.line.partnerLoci.push(locus)
        seen.exempt ||= exempt
      }
      if (!seen.line.partnerRefNames.includes(partnerRef)) {
        seen.line.partnerRefNames.push(partnerRef)
      }
      return
    }
    byLineKey.set(key, {
      line: {
        x: { refName, bp },
        dir,
        support: clusterSupport,
        partnerRefNames: [partnerRef],
        partnerLoci: [locus],
      },
      clusters: new Set([cluster]),
      exempt,
    })
  }

  // One arc per distinct junction, filed into the half that can draw it off the
  // connection's two region indices. Two refNames cannot share a displayed
  // region, so an interchromosomal arc can only take the cross-region branch.
  function pushArc(
    arc: Omit<ComputedArc, 'support' | 'key'>,
    p1RegionIndex: number | undefined,
    p2RegionIndex: number | undefined,
    // The connection's index in `pendingArcs`, for its arm directions
    // (`CrossRegionArc.p1Dir`) and the fragment it counts as.
    pendingIndex: number,
    // The reads this connection already stands for when its family is
    // clustered (`ComputedArc.support`); absent means count one per fragment.
    clusterSupport?: number,
    // The true endpoints when the drawn feet are collapsed (an unplaced mark).
    // The key must take these, or every read at that outer edge coalesces into
    // one mark whatever its partner.
    keyFeet?: { p1Ref: string; p1Bp: number; p2Ref: string; p2Bp: number },
  ) {
    const key = arcKey({
      p1Ref: keyFeet?.p1Ref ?? arc.p1.refName,
      p1Bp: keyFeet?.p1Bp ?? arc.p1.bp,
      p2Ref: keyFeet?.p2Ref ?? arc.p2.refName,
      p2Bp: keyFeet?.p2Bp ?? arc.p2.bp,
      colorType: arc.colorType,
      shapeType: arc.shapeType,
      yBp: arc.yBp,
      spanBp: arc.spanBp,
    })
    const seen = byKey.get(key)
    if (seen) {
      // Nothing to add on the clustered arm: connections sharing both
      // coordinates share a cluster and its size.
      if (clusterSupport === undefined && addsFragment(key, pendingIndex)) {
        seen.support++
      }
      return
    }
    firstAt.set(key, pendingIndex)
    const computed: ComputedArc = {
      ...arc,
      support: clusterSupport ?? 1,
      key,
    }
    byKey.set(key, computed)
    // An arc with either foot in no displayed region is not cross-region: it
    // has no second pixel and stays per-region (`arcTouchesRegion`).
    if (
      p1RegionIndex !== undefined &&
      p2RegionIndex !== undefined &&
      p1RegionIndex !== p2RegionIndex
    ) {
      // `Object.assign`, not a spread: the identity has to be the one in
      // `byKey`, or a later `support++` lands on an arc nothing draws.
      crossRegion.push(
        Object.assign(computed, {
          p1RegionIndex,
          p2RegionIndex,
          p1Dir: pendingArcs[pendingIndex]!.p1Dir,
          p2Dir: pendingArcs[pendingIndex]!.p2Dir,
        }),
      )
    } else {
      arcs.push(computed)
    }
  }

  for (let i = 0; i < pendingArcs.length; i++) {
    const arc = pendingArcs[i]!
    const { p1Ref, p1Bp, p2Ref, p2Bp } = arc
    // One category gate over every mark a connection can become, so no branch
    // below can bypass it.
    const interchromosomal = p1Ref !== p2Ref
    if (
      !passesCategory(
        interchromosomal || (!arc.isSplit && arc.interchrom),
        filter.interchrom,
      ) ||
      !passesCategory(
        !interchromosomal && arc.offScreen === true,
        filter.offscreenMates,
      )
    ) {
      continue
    }
    // The region lookup for this connection, and the only one: every decision
    // below about where it draws, arc or tick included, reads these two.
    const p1RegionIndex = regionIndexOf(displayedRegions, p1Ref, p1Bp)
    const p2RegionIndex = regionIndexOf(displayedRegions, p2Ref, p2Bp)
    // Interchromosomal: always the one interchromosomal color, since insert
    // size, distance and pair orientation mean nothing across refs, and on a
    // curve the color is the only channel saying it crosses chromosomes.
    if (interchromosomal) {
      // The cluster's size is both marks' support (`ComputedArc.support`); the
      // tick also takes its identity, to add each event once (`pushLine`). No
      // mark is moved to a merged position: each draws at its own read's.
      const cluster = clusterOf[i]!
      const support = sizeOf[cluster]!
      const exempt = arc.isSplit
      // An arc when both feet are in displayed regions, ticks otherwise, per
      // connection; a tick claims a connection to somewhere unseen. Not in the
      // read cloud: TLEN is 0 across refs, so `computeArcShape` would fall back
      // to a ~100 Mb endpoint gap and rescale every lane's insert-size axis
      // (ARC_BAND.md).
      if (
        !cloud &&
        p1RegionIndex !== undefined &&
        p2RegionIndex !== undefined
      ) {
        // Gated on the same number it draws with; the ticks' gate waits for
        // their sum.
        if (clearsInterchromFloor(exempt, support, minInterchromReads)) {
          pushArc(
            {
              p1: { refName: p1Ref, bp: p1Bp },
              p2: { refName: p2Ref, bp: p2Bp },
              colorType: ARC_COLOR_INTERCHROM,
              shapeType: ARC_SHAPE_ARC,
              yBp: 0,
              // No span across chromosomes; the hover prints two positions.
              spanBp: 0,
            },
            p1RegionIndex,
            p2RegionIndex,
            i,
            support,
          )
        }
      } else {
        // Each endpoint's tick names the other's chromosome; one off every
        // displayed region is dropped by `lineTouchesRegion`. Pushed unfiltered:
        // the floor is taken against the coalesced total (`pushLine`).
        pushLine(p1Ref, p1Bp, arc.p1Dir, p2Ref, p2Bp, cluster, support, exempt)
        pushLine(p2Ref, p2Bp, arc.p2Dir, p1Ref, p1Bp, cluster, support, exempt)
      }
      continue
    }

    // The cloud's ordinary pair is one of modal |TLEN|, not one flagged
    // proper, so a proper pair of odd length stays.
    if (
      cloud &&
      !showOrdinaryPairs &&
      !arc.isSplit &&
      isConcordantFRPair(arc.pairOrientationNum, arc.tlen, arc.stats)
    ) {
      continue
    }

    const absrad = Math.abs((p2Bp - p1Bp) / 2)

    // No bp distance hides or reshapes a pair with both mates visible; a far arc
    // collapsing to vertical lines is purely the renderer's response to zoom.
    const colorType = getArcColorType(arc)
    // The arcs' ordinary pair (DEEP_COVERAGE.md) must be both proper by the
    // read filter's rule (`isConcordantPairRead`) and painting the baseline
    // slot (`arcPaintRank`), so "hidden" and "grey" are one set and a proper
    // pair painted short-insert stays. A split junction is never ordinary.
    if (
      !cloud &&
      !showOrdinaryPairs &&
      !arc.isSplit &&
      arcPaintRank(colorType) === 0 &&
      isConcordantPairRead(arc.flags, arc.pairOrientationNum)
    ) {
      continue
    }

    // Whether the view can place each end, asked of the loaded list, not
    // `displayedRegions`, which in an ordinary LGV is the whole chromosome.
    // Widened by `cloudReachBp`. Two discontiguous displayed regions are two
    // loaded regions, so a pair bridging them stays placed however far apart.
    const p1Placed = nearLoadedRegion(loadedRegions, p1Ref, p1Bp, reachBp)
    const p2Placed = nearLoadedRegion(loadedRegions, p2Ref, p2Bp, reachBp)
    const shape = computeArcShape({
      cloud,
      arc,
      absrad,
      placed: p1Placed && p2Placed,
    })
    // An unplaced connection is one mark at the end that is on screen: both
    // feet collapse onto that end in bp, so the marks and hit test need no
    // geometry of their own. The placed end is chosen, not assumed, since a
    // split chain can step off screen on either side; neither placed means two
    // off-screen segments, which no region takes. The far coordinate survives in
    // `spanBp` for the hover and in `keyFeet` for the key.
    const keepP1 = p1Placed || !p2Placed
    const foot = keepP1
      ? { refName: p1Ref, bp: p1Bp }
      : { refName: p2Ref, bp: p2Bp }
    const unplaced = shape.shapeType === ARC_SHAPE_FLAT_UNPLACED
    const p1 = unplaced ? foot : { refName: p1Ref, bp: p1Bp }
    const p2 = unplaced ? foot : { refName: p2Ref, bp: p2Bp }
    // The region indices collapse with the feet, or the mark is filed
    // cross-region and drawn back out as a bar wherever the far foot lands in a
    // second displayed region.
    const footRegionIndex = keepP1 ? p1RegionIndex : p2RegionIndex
    pushArc(
      {
        p1,
        p2,
        colorType,
        ...shape,
      },
      unplaced ? footRegionIndex : p1RegionIndex,
      unplaced ? footRegionIndex : p2RegionIndex,
      i,
      undefined,
      unplaced ? { p1Ref, p1Bp, p2Ref, p2Bp } : undefined,
    )
  }

  arcs.sort(arcPaintOrder)
  // SVG document order is paint order, so the overlay's half is sorted too.
  crossRegion.sort(arcPaintOrder)

  // The ticks' floor, applied to the summed support (`pushLine`).
  const kept = [...byLineKey.values()].filter(e =>
    clearsInterchromFloor(e.exempt, e.line.support, minInterchromReads),
  )
  const lines = kept.map(e => e.line)

  // Ticks are opaque and the hit test takes the later-drawn, so they paint
  // heaviest last; bp and side are unique within a refName, the only scope
  // drawn together.
  lines.sort(
    (a, b) => a.support - b.support || a.x.bp - b.x.bp || a.dir - b.dir,
  )
  // Sorted, since first-seen order is arrival order and not stable.
  for (const line of lines) {
    line.partnerRefNames.sort()
    line.partnerLoci.sort(
      (a, b) =>
        b.support - a.support ||
        a.refName.localeCompare(b.refName) ||
        a.bp - b.bp,
    )
  }

  return { arcs, crossRegion, lines }
}

/**
 * Which interchromosomal cluster each pending arc belongs to, and each
 * cluster's size: an interchromosomal mark's `support`, which
 * `minInterchromReads` gates. Taken over every lane at once, since grouping by
 * strand scatters a breakpoint's pairs across lanes. The window is the
 * library's fragment length (`stats.upper`). Skipped while `interchrom` is
 * excluded.
 */
function interchromClusters(
  pendingArcs: PendingArc[],
  { stats }: ArcScale,
  { filter = {} }: ArcCollectionSettings,
): InterchromClusters {
  return filter.interchrom !== 'exclude'
    ? clusteredInterchromSupport(
        pendingArcs,
        stats?.upper ?? DEFAULT_INTERCHROM_WINDOW_BP,
      )
    : { clusterOf: [], sizeOf: [] }
}

/**
 * Arcs, cross-region arcs and connector ticks for one group's pileup data:
 * the single-group entry point (`computeArcsByGroup` pools across lanes).
 * `displayedRegions` defaults to the fetched list (`ArcRegions`).
 */
export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  regions: RegionInfo[],
  settings: ArcSettings,
  displayedRegions: RegionInfo[] = regions,
) {
  const inputs = collectArcInputs(rpcDataMap, regions, settings)
  const scale = poolArcScale([inputs])
  return resolveArcs(
    inputs.pendingArcs,
    settings,
    { loaded: regions, displayed: displayedRegions },
    interchromClusters(inputs.pendingArcs, scale, settings),
  )
}

/**
 * Everything one fetch's arcs are: both drawable halves, plus the facts asked
 * across lanes. Those are computed here, over both halves and after
 * regionization, because which arcs a lane draws has two answers once
 * cross-region arcs leave the per-region feed, and an arc reaching no region
 * is dropped by `arcTouchesRegion` and must not key a legend swatch.
 */
export interface ArcsByGroupResult {
  byGroup: Map<string, Map<number, ArcsUploadData>>
  // The arcs no per-region buffer can draw, per group (`CrossRegionArc`).
  crossRegionByGroup: Map<string, CrossRegionArc[]>
  // The lanes with any arc-band ink in either half, which reserve a band strip;
  // a lane may have ink only in the overlay.
  inkGroupKeys: Set<string>
  // The arc color slots drawn across every lane, raw; the legend maps them
  // through `arcSlotCategory`.
  colorSlots: Set<number>
  // The largest reported flat-arc span, the read cloud's Y domain; 0 when
  // nothing flat is drawn.
  maxFlatArcSpanBp: number
}

/**
 * The full arc upload feed for every group of one fetch: collected over every
 * lane, resolved per lane against one pooled scale. Every group handed in is
 * pooled, so hidden lanes must already be out of `rawDataByGroup`
 * (`buildRawDataByGroup`).
 */
export function computeArcsByGroup(
  rawDataByGroup: ReadonlyMap<string, Map<number, WorkerPileupData>>,
  regions: ArcRegions,
  settings: ArcSettings,
): ArcsByGroupResult {
  return resolveArcsByGroup(
    collectArcs(rawDataByGroup, regions.loaded, settings),
    regions,
    settings,
  )
}

/**
 * `computeArcsByGroup`'s first half, which the connectors over the pileup
 * read too: every lane's pending arcs, the pooled scale, the
 * inter-chromosomal clusters, and the QNAMEs whose mate-link connection
 * gathers fewer reads at its breakpoint than `minInterchromReads`, the
 * verdict the band's arc gate reaches for the same connection.
 */
export interface ArcCollection {
  lanes: { key: string; pending: PendingArc[] }[]
  scale: ArcScale
  clusters: InterchromClusters
  belowFloor: ReadonlySet<string>
}

// The settings collection reads, so a color or mark change resolves again
// without collecting again.
export type ArcCollectionSettings = Pick<
  ArcSettings,
  'filter' | 'canonicalRefName'
>

export function collectArcs(
  rawDataByGroup: ReadonlyMap<string, Map<number, WorkerPileupData>>,
  loaded: RegionInfo[],
  settings: ArcCollectionSettings,
): ArcCollection {
  // Collection is pooled across lanes (`collectPendingArcsByLane`); a lane
  // that produced nothing still gets an empty entry, since the band
  // reservation reads `byGroup` for every drawn group.
  const arcsByLane = collectPendingArcsByLane(
    groupLaneReadsByName(rawDataByGroup, loaded),
    arcChainContext(settings),
  )
  const scale = poolArcScale(
    [...rawDataByGroup.values()].map(rawMap => ({
      stats: insertSizeStatsOf(rawMap),
    })),
  )
  const keys = [...rawDataByGroup.keys()]
  const lanes = keys.map(key => ({
    key,
    pending: arcsByLane.get(key)?.arcs ?? [],
  }))
  const pending = lanes.flatMap(lane => lane.pending)
  const names = keys.flatMap(key => arcsByLane.get(key)?.names ?? [])
  const clusters = interchromClusters(pending, scale, settings)
  const { minInterchromReads = 1 } = settings.filter ?? {}
  const belowFloor = new Set<string>()
  for (const [i, arc] of pending.entries()) {
    const cluster = clusters.clusterOf[i] ?? -1
    if (
      cluster >= 0 &&
      !clearsInterchromFloor(
        arc.isSplit,
        clusters.sizeOf[cluster]!,
        minInterchromReads,
      )
    ) {
      belowFloor.add(names[i]!)
    }
  }
  return { lanes, scale, clusters, belowFloor }
}

/** `computeArcsByGroup`'s second half: the band's feeds from a collection. */
export function resolveArcsByGroup(
  { lanes, clusters }: ArcCollection,
  regions: ArcRegions,
  settings: ArcSettings,
): ArcsByGroupResult {
  const byGroup = new Map<string, Map<number, ArcsUploadData>>()
  const crossRegionByGroup = new Map<string, CrossRegionArc[]>()
  const inkGroupKeys = new Set<string>()
  const colorSlots = new Set<number>()
  let maxFlatArcSpanBp = 0
  let offset = 0
  for (const { key, pending } of lanes) {
    const { arcs, crossRegion, lines } = resolveArcs(
      pending,
      settings,
      regions,
      {
        clusterOf: clusters.clusterOf.slice(offset, offset + pending.length),
        sizeOf: clusters.sizeOf,
      },
    )
    offset += pending.length
    // Keyed on the loaded list: a block draws from it.
    const regionMap = arcsToRegionMap({ arcs, lines }, regions.loaded)
    byGroup.set(key, regionMap)
    crossRegionByGroup.set(key, crossRegion)

    // Over both halves and after regionization (`ArcsByGroupResult`).
    let hasInk = crossRegion.length > 0
    for (const data of regionMap.values()) {
      if (hasArcBandInk(data)) {
        hasInk = true
      }
      for (const ct of data.arcColorTypes) {
        colorSlots.add(ct)
      }
      // Every tick is ARC_COLOR_INTERCHROM.
      if (data.numArcLines > 0) {
        colorSlots.add(ARC_COLOR_INTERCHROM)
      }
      if (data.maxFlatArcSpanBp > maxFlatArcSpanBp) {
        maxFlatArcSpanBp = data.maxFlatArcSpanBp
      }
    }
    // The per-region arm's axis rule: whether a span sizes the axis depends on
    // the shape, not on which buffer the arc landed in.
    for (const arc of crossRegion) {
      colorSlots.add(arc.colorType)
      if (
        plotsOnInsertSizeAxis(arc.shapeType) &&
        arc.spanBp > maxFlatArcSpanBp
      ) {
        maxFlatArcSpanBp = arc.spanBp
      }
    }
    if (hasInk) {
      inkGroupKeys.add(key)
    }
  }
  return {
    byGroup,
    crossRegionByGroup,
    inkGroupKeys,
    colorSlots,
    maxFlatArcSpanBp,
  }
}
