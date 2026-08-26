import { ARC_COLOR_INTERCHROM } from '../../shaders/slang/arcLine.consts.generated.ts'
import { isConcordantPairRead } from '../../shared/buildBaseFeatureData.ts'
import {
  collectPendingArcs,
  computePairingInfo,
  groupReadsByName,
} from './arcChains.ts'
import {
  DEFAULT_INTERCHROM_WINDOW_BP,
  INTERCHROM_ARC_YBP,
  arcKey,
  clearsInterchromFloor,
  clusteredInterchromSupport,
} from './arcClustering.ts'
import {
  arcPaintOrder,
  arcPaintRank,
  getArcColorType,
  isConcordantFRPair,
} from './arcColors.ts'
import { arcsToRegionMap, regionIndexOf } from './arcRegions.ts'
import { CLOUD_JITTER_BOUNDS } from './arcTypes.ts'
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
import type {
  ArcRegions,
  ArcSettings,
  ComputedArc,
  ComputedLine,
  CrossRegionArc,
  PendingArc,
  RegionInfo,
} from './arcTypes.ts'
import type { ArcsUploadData } from './types.ts'

// NOTHING IS RE-EXPORTED FROM HERE, and that is the point of the file split
// rather than a tidiness preference. The types live in `arcTypes.ts`, colour
// classification in `arcColors.ts`, region partitioning in `arcRegions.ts`, read
// grouping in `arcChains.ts`; every consumer imports the module that DEFINES
// what it wants.
//
// This module used to forward all four "because `compute.ts` is the import site
// every consumer already knows", and the cost of that convenience is the one
// `shapes.ts`' header spells out — two thousand lines of read grouping, junction
// clustering and colour classification pulled into the render path for a
// comparator and a lookup table, plus "a cycle waiting for the first time
// `compute.ts` wants anything back from `mark.ts`". That edge had arrived:
// `crossRegionOverlay.ts` imports `mark.ts` and reached `arcPaintOrder` and
// `CrossRegionArc` through here, and two React components took
// `arcColorLegendCategory` the same way. `drawCanvas.ts` states the identical
// rule one layer down for the generated modules — "with no re-export hop".

// Deterministic 0..1 hash from arc endpoints — gives each pair a stable jitter
// offset regardless of fetch/render order, so snapshot tests don't flake.
// `Math.sin(x)*43758.5453 mod 1` is the standard GPU-style cheap hash.
function pairJitter01(aBp: number, bBp: number) {
  // Order-normalized INSIDE the hash rather than at the call site, so this is a
  // property of the junction and no caller can forget to make it one. The two
  // multipliers differ, so a pair named (a, b) and the same pair named (b, a)
  // hashed to different offsets and drew as two flat lines at slightly
  // different Y — which is the same junction split in two, exactly what
  // `arcKey`'s normalization exists to prevent, and it would have defeated that
  // fix in read-cloud mode since `yBp` is what the two arcs would then differ
  // in. "Stable regardless of fetch/render order" was already the stated
  // contract; mate order is that same kind of accident.
  const p1Bp = Math.min(aBp, bBp)
  const p2Bp = Math.max(aBp, bBp)
  // Math.imul keeps each product a true 32-bit multiply; a plain `*` overflows
  // the 2^53 safe-integer range for large genomic coordinates (bp·constant ≈
  // 1e17) and silently rounds away low bits before the `>>> 0`.
  const seed = (Math.imul(p1Bp, 374761393) + Math.imul(p2Bp, 668265263)) >>> 0
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

// Pick the shape constant and target Y (in genomic bp) for a single arc.
// Read cloud: flat line with ±8% multiplicative jitter so coincident reads separate
// visually. Y is the pair's genomic span on the shared insert-size axis: a mate
// link plots at Y=|tlen|; a split junction (no tlen) at the full breakpoint gap
// |p2Bp−p1Bp| — NOT half of it, so a split-supported SV lands on the same
// insertSizeTicks ruler height as the equivalent-span discordant pair (and isn't
// mislabeled at half its real size). A pair whose TLEN is *unset* (0 — the SAM
// "information unavailable" encoding, which discordant and supplementary records
// often carry) falls back to that same breakpoint gap, for the reason
// getArcColorType already distrusts TLEN there: plotting it at |0| would park
// exactly the reads read cloud exists to surface on the baseline. Otherwise it's
// the single curved ARC shape (the renderer chooses dome vs vertical-lines by
// zoom); Y is the genomic radius.
//
// A CONNECTION THE VIEW CAN PLACE ONLY ONE END OF LEAVES THE AXIS
// (ARC_SHAPE_FLAT_UNPLACED at `yBp` 0, drawn on the zero anchor). A read cloud
// bar joins two feet, and when the partner sits outside every loaded region
// there is no second pixel to draw to: the bar is extrapolated to a coordinate
// no block covers, runs off the screen edge, and paints the full width of the
// band while saying nothing its near foot does not. On HG002 300x that is 96
// screen-wide bars in one 200 kb window, and they are the solid mass along the
// bottom.
//
// The same connection also sets `arcsYDomainBp` for every lane — 379 of 5,281
// arcs over 47 deep 20 kb windows have a partner more than 1 Mb away, spread
// uniformly over the chromosome, so the median window's axis topped out at 73 Mb
// and every real pair was squeezed into the top third of the band. That is the
// failure the interchromosomal exclusion below was written to prevent, reached
// from a same-chromosome connection; `plotsOnInsertSizeAxis` is the other half.
//
// IT IS A PLACEMENT TEST, NOT A SPAN THRESHOLD, and the difference is the whole
// design. A pair 5 Mb apart in a view showing BOTH of its ends — two
// discontiguous displayed regions at the two breakpoints, which is what read
// connections exist for — draws its bar between two real pixels and belongs on
// the axis. A pair 30 kb apart in a 20 kb window does not. So the question is
// what is on screen, and the answer moves with the view: zoom out, or bring the
// partner's locus into a second region, and the same connection joins the axis.
function computeArcShape({
  cloud,
  arc,
  absrad,
  placed,
}: {
  cloud: boolean
  arc: PendingArc
  absrad: number
  // Whether BOTH feet fall in a region this fetch loaded — the one question
  // that decides whether a bar can be drawn at all.
  placed: boolean
}) {
  const { p1Bp, p2Bp } = arc
  if (cloud) {
    // `|| gap` reads as the fallback it is: a split junction has no tlen at
    // all, and an unset one is 0. Routing splits through a 0 sentinel so the
    // next line's `> 0` could catch both hid that the union already proves
    // which arm has a tlen.
    const gapBp = Math.abs(p2Bp - p1Bp)
    const spanBp = arc.isSplit ? gapBp : Math.abs(arc.tlen) || gapBp
    if (!placed) {
      // No jitter: the anchor row is not a scale, so there is nothing for a
      // ±8% offset to separate. `spanBp` survives for the hover, which is the
      // only place the distance to the unplaced partner is still readable.
      return { shapeType: ARC_SHAPE_FLAT_UNPLACED, yBp: 0, spanBp }
    }
    const jitter = 1 + CLOUD_JITTER_BOUNDS * (pairJitter01(p1Bp, p2Bp) * 2 - 1)
    return {
      shapeType: arc.isSplit ? ARC_SHAPE_FLAT_SPLIT : ARC_SHAPE_FLAT,
      yBp: Math.round(spanBp * jitter),
      // The jitter is a DRAWING device — it exists so coincident lines don't
      // stack into one — so the span survives it separately for anything that
      // reports a number rather than a position. The hover read `yBp` back as
      // "Insert size", which is that number times a deterministic factor in
      // [0.92, 1.08]: a 10 kb insert was reported as anything from 9.2 to 10.8
      // kb, and reproducibly so, since the factor is a hash of the endpoints.
      spanBp,
    }
  }
  return { shapeType: ARC_SHAPE_ARC, yBp: absrad, spanBp: absrad }
}

// Per-group half of the pipeline: the expensive read grouping + connection
// resolution, plus the two dataset facts a pooled scale is built from. Split out
// so every group's arcs exist before any of them is colored.
interface ArcInputs {
  pendingArcs: PendingArc[]
  hasPaired: boolean
  stats: InsertSizeBand | undefined
}

function collectArcInputs(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  regions: RegionInfo[],
  settings: ArcSettings,
): ArcInputs {
  const readsByName = groupReadsByName(rpcDataMap, regions)
  const { hasPaired, stats } = computePairingInfo(rpcDataMap)
  const pendingArcs = collectPendingArcs(readsByName, {
    drawLongRange: settings.drawLongRange,
    drawInter: settings.drawInter,
    canonicalRefName: settings.canonicalRefName ?? (refName => refName),
  })
  return { pendingArcs, hasPaired, stats }
}

// Everything that decides an arc's COLOR but belongs to the whole fetched read
// set rather than to one group. Pooled for the same reason the worker pools
// `insertSizeStats` and the model maxes `arcsYDomainBp` across groups: a
// per-group scale paints the same pair long-insert in one stacked section and
// normal in the next, and `hasPaired` switches whole lanes between the
// pair-orientation and split-junction branches of `getArcColorType`. `stats` is
// already the worker's pooled band, so pooling it here is just picking the one
// value every group carries.
interface ArcScale {
  hasPaired: boolean
  stats: InsertSizeBand | undefined
}

function poolArcScale(inputs: ArcInputs[]): ArcScale {
  return {
    hasPaired: inputs.some(i => i.hasPaired),
    stats: inputs.find(i => i.stats !== undefined)?.stats,
  }
}

// Colour + shape one group's resolved connections against the pooled scale,
// COALESCING connections that would draw as the same arc.
//
// Every read spanning a junction used to contribute its own instance, and arc
// colours are opaque with no alpha, so N identical arcs were pixel-identical to
// one: the picture said "a junction is here" and could not say how many reads
// said so. Measured on the HG002 chr12 fold-back, a 24 kb window: 89
// connections over 38 distinct arcs, the busiest drawn 27 times, and a 6-read
// junction 689 bp away drawn with exactly the same weight as the 27-read one.
//
// Coalescing is what lets support become a channel (`arcLineWidth`) instead of
// being thrown away, and it removes the redundant instances rather than
// stacking them: 57% of the arcs in that window were exact repeats.
//
// The read-cloud jitter does not stop two identical pairs coalescing: it hashes
// the same two bp to the same offset (`pairJitter01`), so arcs agreeing on the
// endpoints agree on it. What it does NOT make agree is the span the offset
// scales — see `arcKey`, which is why `yBp` is keyed on.
//
// THREE outputs, from ONE region lookup per connection. The alternative — emit
// arcs, then partition them in a second pass — was written first and is worse
// for a reason that is not style: the second pass has to ask "which region is
// this foot in" all over again, so "an interchromosomal arc is always in the
// cross-region set" holds only as long as the two lookups agree. Deciding it
// here, off `p1RegionIndex`/`p2RegionIndex` resolved once, makes it structural,
// which is what `groupArcsByRef` and `arcTouchesRegion` both rely on.
function resolveArcs(
  pendingArcs: PendingArc[],
  { hasPaired, stats }: ArcScale,
  settings: ArcSettings,
  regions: ArcRegions,
) {
  const { displayed: displayedRegions, loaded: loadedRegions } = regions
  const {
    colorByType,
    cloud = false,
    drawInter,
    drawProperPairArcs = true,
    minInterchromSupport = 1,
  } = settings
  const arcs: ComputedArc[] = []
  const crossRegion: CrossRegionArc[] = []
  // ONE map over both arrays. An arc is pushed to exactly one of them on first
  // sight and the later `support++` mutates that same object, so the count
  // cannot end up on a copy in the other half.
  const byKey = new Map<string, ComputedArc>()
  // The tick, the clusters already counted into it, and whether any of them is
  // exempt from the floor — see `pushLine`. All three are off `ComputedLine`
  // because they are bookkeeping for the coalescing rather than fields of the
  // mark, and `clusters` is one element for all but a coordinate two events
  // share.
  const byLineKey = new Map<
    string,
    { line: ComputedLine; clusters: Set<number>; exempt: boolean }
  >()

  // The window is the LIBRARY's, not a constant: how far a supporting read can
  // sit from the breakpoint is one fragment length, and `stats.upper` is the
  // number this pipeline already computes for it. A hardcoded window would be
  // wrong at both ends — too wide to discriminate on a 150 bp amplicon library,
  // too narrow to hold one cluster together on a 3 kb mate-pair library, where
  // it would split a real translocation into the singletons the floor then eats.
  //
  // RUN AT EVERY SUPPORT SETTING, including the menu's `all` position where
  // nothing can be filtered out, because the floor is no longer the only
  // consumer: this is also what an interchromosomal mark's `support` IS. See
  // `ComputedArc.support`.
  //
  // Skipped entirely when `drawInter` is off, which is the one setting that
  // makes it dead rather than merely unfiltered: every reader below sits inside
  // the interchromosomal branch, and that branch now returns before the first of
  // them. `collectPendingArcs` still emits interchromosomal connections while
  // `drawLongRange` is on (`emitsOffScreenPartner` is an OR), so without this
  // the whole pass — a walk, a Map of contig pairs and a union-find over ~10% of
  // the feed on deep short-read data — ran to build two arrays nothing read.
  const { clusterOf, sizeOf } = drawInter
    ? clusteredInterchromSupport(
        pendingArcs,
        stats?.upper ?? DEFAULT_INTERCHROM_WINDOW_BP,
      )
    : { clusterOf: [], sizeOf: [] }

  // One tick per breakpoint, COUNTING the reads that agree on it — the same
  // move `arcKey` makes for arcs, and for the same two reasons.
  //
  // Every read over a translocation used to push its own pair of ticks. Opaque
  // marks at one x, so N of them were pixels-identical to one: the picture said
  // "a breakpoint is here" and could not say how many reads said so. Worse, the
  // GPU pass shades its edges by coverage (`strokeCoverage`), so the duplicates
  // alpha-composited and a 50-read breakpoint drew a perceptibly wider,
  // harder-edged tick than a 1-read one, while the Canvas2D mirror strokes
  // opaque and drew the two the same.
  //
  // Coalescing is what lets `support` become a channel (`arcLineWidth`, the
  // same curve the arcs use) instead of being thrown away, and what gives the
  // hover something to report. Deduping alone would have been lossy.
  //
  // THE SUM OF THE DISTINCT CLUSTERS reaching this coordinate, which is neither
  // of the two obvious numbers and is the only one that survives both cases.
  //
  // Counting the connections AT the coordinate — which this did — is the
  // measurement the interchromosomal family was already shown not to have. Mate
  // pairs straddle a breakpoint rather than landing on it, so the count is 1 for
  // 862 of 865 connections (`ComputedArc.support`), and the tick is the mark a
  // SINGLE-chromosome view draws for a translocation: the arc half of the fix
  // never reaches it. Worse, `minInterchromSupport` gates a tick on its cluster,
  // so a five-pair breakpoint cleared a floor of 2 and then drew, and hovered,
  // as one read.
  //
  // Taking the cluster's own size instead understates the other way: two
  // singleton events sharing a chr1 base (`a breakpoint reaching two chromosomes
  // names both`) would report the larger, 1, for the two reads sitting there.
  // `partnerRefNames` is plural for exactly that shape.
  //
  // So: each cluster contributes its size ONCE. A tick is half a junction, and
  // the reads standing behind the halves that meet here is what it can say. Its
  // two coordinates of one event do both report the whole event — the same trade
  // an arc makes, and for the same reason: the mark is the junction and the
  // POSITION is its own read's.
  //
  // EVERY CLUSTER IS COUNTED, and `minInterchromSupport` is applied to the SUM
  // afterwards rather than to each addend. Filtering the addends made the number
  // a tick reports depend on the setting: on one donor with a 3-read and a
  // 1-read acceptor, the donor coordinate read 4 at `all` and 3 at the default
  // floor of 2, over four reads that all cross that base either way. The gate and
  // the drawn number are supposed to be one number — `ComputedArc.support` says
  // so — and they are on the arc arm, where an arc IS one cluster. On this arm
  // the number is a sum, so the gate has to be taken against the sum or it is
  // testing one term of it.
  //
  // It also deleted marks the floor had no quarrel with: two reads at one
  // breakpoint whose partners land 3 bp apart are two clusters of 1, so nothing
  // drew at a coordinate two reads agree on. Summing first draws it at 2.
  function pushLine(
    refName: string,
    bp: number,
    partnerRef: string,
    cluster: number,
    clusterSupport: number,
    // Whether this cluster's evidence answers to the floor at all — see
    // `clearsInterchromFloor`. One exempt cluster keeps the tick whatever the
    // sum, since the floor is a statement about scattered mate pairs and has
    // nothing to say about a read that crosses the breakpoint.
    exempt: boolean,
  ) {
    const key = `${refName}\0${bp}`
    const seen = byLineKey.get(key)
    if (seen) {
      if (!seen.clusters.has(cluster)) {
        seen.clusters.add(cluster)
        seen.line.support += clusterSupport
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
        support: clusterSupport,
        partnerRefNames: [partnerRef],
      },
      clusters: new Set([cluster]),
      exempt,
    })
  }

  // One arc per distinct junction, COALESCING the reads that agree on it — the
  // same move `pushLine` makes for the ticks, keyed by `arcKey`.
  //
  // It also files each arc into the half that can DRAW it, off the two region
  // indices resolved once per connection above. BOTH producers go through here,
  // and that is what makes "an interchromosomal arc is never in the per-region
  // feed" structural rather than a rule two branches happen to agree on: two
  // refNames cannot land in one displayed region, so the cross-region branch is
  // the only one such an arc can take. `groupArcsByRef` is keyed on exactly that.
  function pushArc(
    arc: Omit<ComputedArc, 'support' | 'key'>,
    p1RegionIndex: number | undefined,
    p2RegionIndex: number | undefined,
    // The two arm directions, carried through from the producer that chose the
    // endpoints. Taken here rather than on `arc` because they are only kept on
    // the cross-region half — see `CrossRegionArc.p1Dir`.
    feetDirs: { p1Dir: number; p2Dir: number },
    // The reads this connection already stands for, when its family cannot be
    // counted a read at a time — `ComputedArc.support`. Absent means COUNT: each
    // connection is one more read agreeing on this junction to the base.
    clusterSupport?: number,
  ) {
    const key = arcKey({
      p1Ref: arc.p1.refName,
      p1Bp: arc.p1.bp,
      p2Ref: arc.p2.refName,
      p2Bp: arc.p2.bp,
      colorType: arc.colorType,
      shapeType: arc.shapeType,
      yBp: arc.yBp,
    })
    const seen = byKey.get(key)
    if (seen) {
      // Nothing to add on the clustered arm, and that is an invariant rather
      // than a shortcut: every connection coalescing onto one arc shares both
      // coordinates, so it is in the same cluster and arrived with the same
      // number. One arc is one junction is one cluster.
      if (clusterSupport === undefined) {
        seen.support++
      }
      return
    }
    const computed: ComputedArc = {
      ...arc,
      support: clusterSupport ?? 1,
      // kept for the sort's tie-break below, where it is the only thing that
      // does not depend on what order the reads arrived in
      key,
    }
    byKey.set(key, computed)
    // pushed in first-seen order, so the feed's order is still the reads' —
    // a later support bump mutates the entry already in the array
    //
    // An arc with EITHER foot in no displayed region is not cross-region: that
    // is the off-screen-partner case, which has no second pixel to draw to and
    // keeps `arcTouchesRegion`'s existing handling, where the leg rising toward
    // the screen edge is the correct picture.
    if (
      p1RegionIndex !== undefined &&
      p2RegionIndex !== undefined &&
      p1RegionIndex !== p2RegionIndex
    ) {
      // `Object.assign`, not a spread: the object identity has to be the one in
      // `byKey`, or a later `support++` lands on an arc nothing draws.
      crossRegion.push(
        // Named one at a time rather than spread: the callers hand their whole
        // `PendingArc` in, so a spread would copy `p1Ref`, `tlen`, `isSplit` and
        // the rest onto an arc nothing reads them off.
        Object.assign(computed, {
          p1RegionIndex,
          p2RegionIndex,
          p1Dir: feetDirs.p1Dir,
          p2Dir: feetDirs.p2Dir,
        }),
      )
    } else {
      arcs.push(computed)
    }
  }

  for (let i = 0; i < pendingArcs.length; i++) {
    const arc = pendingArcs[i]!
    const { p1Ref, p1Bp, p2Ref, p2Bp } = arc
    // THE region lookup for this connection, and the only one. Every decision
    // below about where the arc can be drawn is taken from these two.
    //
    // Above every filter rather than beside the one caller that needs it today:
    // the interchromosomal branch asks the same question (commit 3's arc-or-tick
    // decision), and two lookup sites is how the invariant `groupArcsByRef`
    // depends on stops being structural. The cost is a scan of a 1-2 element
    // list, which is nothing next to the `arcKey` string this loop builds for
    // every connection that survives.
    const p1RegionIndex = regionIndexOf(displayedRegions, p1Ref, p1Bp)
    const p2RegionIndex = regionIndexOf(displayedRegions, p2Ref, p2Bp)
    // Interchromosomal. Always painted the single dedicated interchromosomal
    // colour: insert size, long-range distance and pair orientation are all
    // meaningless across refs (a cross-chromosome "pair orientation" is
    // arbitrary), so colouring by them just produces visual noise — one uniform
    // colour regardless of colorByType, and regardless of whether the evidence
    // is a split read or a mate pair. As a TICK that was because the mark
    // carries no colour of its own (ARC_COLOR_INTERCHROM lives in arcLine.slang,
    // where the pass reads it). As an ARC the reason is stronger: "crosses
    // chromosomes" used to be readable from the mark itself, and it is not from
    // a curve — a same-chromosome cross-region arc crosses the same panel
    // divider — so the colour is now the ONLY channel carrying it.
    if (p1Ref !== p2Ref) {
      // ONE gate over both marks, which is the point of hoisting it: `drawInter`
      // used to sit inside the tick push, so an arc branch added beside it would
      // have inherited neither it nor the floor — "Show inter-chromosomal pairs:
      // off" still drawing arcs, and the floor bypassed for connections that now
      // draw a BIGGER mark than the ticks they replace.
      //
      // Scattered IS the criterion for that floor, so it drops the whole
      // connection rather than merging it: a breakpoint whose reads cluster
      // keeps every mark at the coordinate its own read put it at. Merging a
      // cluster would have to invent a position for it, which is the thing
      // `arcKey`'s exact-coordinate rule exists to refuse.
      if (!drawInter) {
        continue
      }
      // The reads behind this connection, and the number both its marks are
      // drawn and reported with — see `ComputedArc.support`. The tick also takes
      // the cluster's IDENTITY, because a coordinate several events reach adds
      // each of them once (`pushLine`).
      const cluster = clusterOf[i]!
      const support = sizeOf[cluster]!
      // Whether the floor has anything to say about this connection's evidence —
      // see `clearsInterchromFloor`.
      const exempt = arc.isSplit
      // AN ARC WHEN BOTH FEET ARE ON SCREEN, ticks otherwise — decided per
      // connection, so a breakpoint reaching one displayed and one undisplayed
      // chromosome gets an arc *and* a tick and both counts stay honest.
      //
      // Replacing the ticks rather than drawing beside them, because a tick's
      // whole job is "there is a connection to somewhere you cannot see",
      // which is precisely false in this configuration. No position is lost:
      // the arc's feet are the two tick positions.
      //
      // NOT IN READ-CLOUD MODE, and that exclusion is the severe one. The
      // cloud's Y axis IS insert size and an interchromosomal connection has
      // none: it carries TLEN 0 (SAM sets it so across refs), so
      // `computeArcShape` would fall back to the endpoint GAP — |ctgBbp -
      // ctgAbp|, about 1.07e8 for a real chr9/chr22 junction — and that
      // becomes a genuine `maxFlatArcSpanBp`, which `arcsYDomainBp` maxes
      // across every group, which `insertSizeTickSections` prints on the
      // ruler. One connection would rescale the whole read cloud to a 107 Mb
      // "insert size" and label it. Arc mode's axis is genomic radius, where
      // the band ceiling is not an invented position — see
      // `INTERCHROM_ARC_YBP`.
      if (
        !cloud &&
        p1RegionIndex !== undefined &&
        p2RegionIndex !== undefined
      ) {
        // THE ARC'S OWN GATE, against the same number it will draw with: an arc
        // is one junction is one cluster, so here the count the floor tests and
        // the count `arcLineWidth` spends are the same value. The tick arm below
        // cannot say that — its number is a sum — so its gate is applied after
        // the summing instead.
        if (clearsInterchromFloor(exempt, support, minInterchromSupport)) {
          pushArc(
            {
              p1: { refName: p1Ref, bp: p1Bp },
              p2: { refName: p2Ref, bp: p2Bp },
              colorType: ARC_COLOR_INTERCHROM,
              shapeType: ARC_SHAPE_ARC,
              yBp: INTERCHROM_ARC_YBP,
              // No reported quantity: the hover prints two POSITIONS for this
              // arc rather than a span, since a bp distance across a
              // translocation is a subtraction of two unrelated number lines.
              // Inert rather than arbitrary — `maxFlatArcSpanBp` reads only flat
              // shapes and `formatArcTooltip` only ARC_SHAPE_FLAT.
              spanBp: 0,
            },
            p1RegionIndex,
            p2RegionIndex,
            arc,
            support,
          )
        }
      } else {
        // Each endpoint's tick names the OTHER endpoint's chromosome — that is
        // the whole content of a translocation marker, and the direction is
        // what makes the two ticks different marks rather than a mirrored
        // pair. The one whose chromosome is not displayed reaches no region
        // and is dropped by `lineTouchesRegion`.
        //
        // Pushed unfiltered: the floor is taken against the coalesced total
        // below, for the reason `pushLine` gives.
        pushLine(p1Ref, p1Bp, p2Ref, cluster, support, exempt)
        pushLine(p2Ref, p2Bp, p1Ref, cluster, support, exempt)
      }
      continue
    }

    // Read cloud suppresses the modal-insert FR pairs so SV signals stand out.
    // Split junctions have no template length, so they never qualify.
    //
    // NOT the same test as the one above, deliberately: this asks whether |TLEN|
    // sits in the modal band, that one asks what the aligner concluded. The
    // cloud exists to surface anything anomalous in SIZE, so it must catch a
    // pair the flags call proper; `isConcordantPairRead`'s comment has the full
    // split. Both can apply — the cloud's is unconditional in cloud mode and the
    // setting above still filters on top of it.
    if (
      cloud &&
      !arc.isSplit &&
      isConcordantFRPair(arc.pairOrientationNum, arc.tlen, stats)
    ) {
      continue
    }

    const absrad = Math.abs((p2Bp - p1Bp) / 2)

    // No bp distance ever hides or reshapes a both-mates-visible pair: every
    // pair renders as an arc. "Long range" is purely the *visual* result of
    // zoom — a far-apart arc collapses to near-vertical lines at its real
    // endpoints (arc.slang), and zooming out to show the whole span restores
    // the rounded arc. (drawLongRange only gates connections to mates that
    // aren't loaded in the current view; see `offScreenMateArcs`.)
    const colorType = getArcColorType({
      arc,
      colorByType,
      hasPaired,
      stats,
    })
    // The user's own suppression of the ordinary case, and the reason it is a
    // setting where the cloud's is not: in ARC mode the concordant domes are the
    // context a discordant pair is read against, so on shallow data they earn
    // their ink. At depth they stop being context and become the picture — 9138
    // of 9204 arcs at 1:2,000,000 on HG002 300x, all painting the baseline slot,
    // with the 66 that mean something riding on top of them
    // (agent-docs/reference/DEEP_COVERAGE.md).
    //
    // TWO conditions, and the second is what keeps the setting honest.
    //
    // `isConcordantPairRead` is the READ filter's rule, shared verbatim, so
    // "Show proper pairs" and this hide the same pairs — one the reads, the
    // other their arcs. But that rule reads the aligner's verdict, and the arc's
    // COLOUR can disagree with it: a pair flagged proper whose |TLEN| falls
    // below the insert band paints short-insert. Hiding it would take a pink arc
    // off the screen under a setting about ordinary pairs, which reads as a bug
    // — measured, it was 42 of the 48 short-insert arcs in that window.
    //
    // So it must ALSO be painting the baseline slot: nothing the display is
    // currently drawing as a category can be hidden as routine, whatever the
    // flags say. `arcPaintRank` is the same classifier the paint order uses, so
    // "hidden" and "grey" are the same set by construction, and both follow
    // `colorByType` — under `orientation` a short insert IS routine, and the
    // setting agrees without being told.
    //
    // A split junction has no pair to call proper and is never suppressed: it is
    // evidence whatever the reads around it are flagged.
    if (
      !drawProperPairArcs &&
      !arc.isSplit &&
      arcPaintRank(colorType) === 0 &&
      isConcordantPairRead(arc.flags, arc.pairOrientationNum)
    ) {
      continue
    }

    // CAN THE VIEW PLACE THIS CONNECTION'S TWO ENDS? Asked of the LOADED list,
    // not the displayed one, and that is the whole point of asking it here:
    // `displayedRegions` in an ordinary LGV is the WHOLE chromosome, so a mate
    // 214 Mb away resolves to a region and reads as perfectly placeable. The
    // loaded list is the fetch — the blocks on screen plus the half-screen each
    // side `planRegionFetch` buffers — which is the data a bar could actually
    // be drawn between.
    //
    // Two discontiguous displayed regions are two loaded regions, so a pair
    // bridging the breakpoints of a long-range event has both feet placed and
    // keeps its bar however far apart they are. That view is what read
    // connections exist for, and the span it puts on the axis is the one the
    // reader asked to see.
    const p1Placed = regionIndexOf(loadedRegions, p1Ref, p1Bp) !== undefined
    const p2Placed = regionIndexOf(loadedRegions, p2Ref, p2Bp) !== undefined
    const shape = computeArcShape({
      cloud,
      arc,
      absrad,
      placed: p1Placed && p2Placed,
    })
    // AN UNPLACED CONNECTION IS ONE MARK AT THE END THAT IS ON SCREEN, so both
    // feet collapse onto that end here rather than one being left at a
    // coordinate no block covers.
    //
    // Collapsing in bp, before anything is projected, is what makes all four
    // renderers agree without a fourth mark geometry: `arcMarkFrom` resolves a
    // zero-length bar to `ARC_FLAT_MIN_PX` centred on the foot, the two endpoint
    // squares land on top of each other there, and the hit test measures that
    // same stub. `arcTouchesRegion` narrows to that one region too, so an
    // unplaced connection stops being packed into every region on its
    // chromosome.
    //
    // `p1` is the placed end for every connection either mate-link producer
    // makes — both put a FETCHED read's own outer edge there (`mateLinkArc`,
    // `offScreenMateArcs`) — but a split chain can step through an off-screen SA
    // segment on either side, so the foot is chosen rather than assumed. Neither
    // placed means the connection joins two off-screen segments, which
    // `arcTouchesRegion` drops from every region anyway.
    //
    // The far coordinate is not lost, only unplotted: `spanBp` carries the
    // distance into the hover, which is the one place it can still be read.
    const keepP1 = p1Placed || !p2Placed
    const foot = keepP1
      ? { refName: p1Ref, bp: p1Bp }
      : { refName: p2Ref, bp: p2Bp }
    const unplaced = shape.shapeType === ARC_SHAPE_FLAT_UNPLACED
    const p1 = unplaced ? foot : { refName: p1Ref, bp: p1Bp }
    const p2 = unplaced ? foot : { refName: p2Ref, bp: p2Bp }
    pushArc(
      {
        p1,
        p2,
        colorType,
        ...shape,
      },
      p1RegionIndex,
      p2RegionIndex,
      arc,
    )
  }

  arcs.sort(arcPaintOrder)
  // The same TOTAL order over the overlay's half, for the same reason one level
  // down: SVG document order is paint order, and equal-support arcs left in the
  // reads' arrival order are not in the same order twice.
  crossRegion.sort(arcPaintOrder)

  // THE TICKS' FLOOR, taken here rather than per contributing cluster — see
  // `pushLine`. This is where the tick family's gate and its drawn number become
  // one number, which is what the arc arm already had by construction.
  const lines = [...byLineKey.values()]
    .filter(e =>
      clearsInterchromFloor(e.exempt, e.line.support, minInterchromSupport),
    )
    .map(e => e.line)

  // The same ordering, for the same reason, over the ticks. They are opaque
  // full-band verticals, so two within a stroke width of each other resolve by
  // paint order, and `hitTestArcBand` reads the feed's order as its
  // last-drawn-wins tie-break. Tie-broken on the breakpoint's own bp, which the
  // coalescing above makes unique WITHIN a refName — the only scope that has to
  // be ordered, since `groupArcsByRef` buckets these before anything draws them
  // and two refNames never share a region's feed.
  lines.sort((a, b) => a.support - b.support || a.x.bp - b.x.bp)
  // Sorted, so a tooltip listing two partners lists them the same way twice.
  // First-seen order is the reads' arrival order, which is not stable across
  // runs — the trap `arcs.sort`'s tie-break is written up for, one field over.
  for (const line of lines) {
    line.partnerRefNames.sort()
  }

  return { arcs, crossRegion, lines }
}

/**
 * Arcs + cross-region arcs + connector ticks for one group's raw pileup data,
 * scaled to that group alone. The single-group entry point; grouped rendering
 * goes through `computeArcsByGroup` instead, which pools the color scale across
 * every lane.
 *
 * `displayedRegions` defaults to the fetched list, which is the truth in the
 * single-region view this entry point describes — see `ArcRegions` for when the
 * two genuinely differ and why the difference matters.
 */
export function computeArcsFromPileupData(
  rpcDataMap: ReadonlyMap<number, WorkerPileupData>,
  regions: RegionInfo[],
  settings: ArcSettings,
  displayedRegions: RegionInfo[] = regions,
) {
  const inputs = collectArcInputs(rpcDataMap, regions, settings)
  return resolveArcs(inputs.pendingArcs, poolArcScale([inputs]), settings, {
    loaded: regions,
    displayed: displayedRegions,
  })
}

/**
 * Everything one fetch's arcs are: both drawable halves, plus the three facts
 * that are asked ACROSS the lanes rather than of one.
 *
 * Those three used to be walks of `byGroup` in the model, and splitting the
 * cross-region arcs out of it broke two of them at once — a legend swatch keyed
 * off arcs that had moved, a Y domain sized without them, a band strip reserved
 * for a lane whose ink was now entirely in the overlay. They were not three
 * slips: "which arcs does this lane draw" had stopped having one answer. They
 * are outputs of the pass holding both halves for that reason, and a third half
 * would have to come through here too.
 *
 * All three are computed AFTER regionization, which is the other half of the
 * same rule. An arc reaching no displayed region at all is dropped by
 * `arcTouchesRegion`, so keying a swatch off the pre-regionization set would
 * name a colour nothing draws.
 */
export interface ArcsByGroupResult {
  byGroup: Map<string, Map<number, ArcsUploadData>>
  // The arcs no per-region buffer can draw, per group — see `CrossRegionArc`.
  // Empty in the single-region view, which is why the overlay that draws them
  // costs nothing there.
  crossRegionByGroup: Map<string, CrossRegionArc[]>
  // The lanes with ANY arc-band ink, in either half. Drives the per-section band
  // reservation: a lane whose reads yield no arc and no tick reserves no strip,
  // so its pileup starts right under its coverage. A lane whose every arc
  // crosses a seam — two windows either side of a breakpoint, the view read
  // connections exist for — has ink in the overlay only, and must still reserve.
  inkGroupKeys: Set<string>
  // The arc colour slots actually drawn, across every lane. The legend maps them
  // through `arcColorLegendCategory`, which needs a setting this pass doesn't
  // have, so the slots stay raw here.
  colorSlots: Set<number>
  // The largest reported flat-arc span, which is the read cloud's Y domain: its
  // axis autoscales to this and `insertSizeTickSections` labels the top tick
  // with it. 0 when nothing flat is drawn.
  maxFlatArcSpanBp: number
}

/**
 * The full arc upload feed for every group of one fetch.
 *
 * Resolution runs per group (a read belongs to exactly one lane, and each lane
 * draws its own band), but the color scale is characterized ONCE across all of
 * them — see `poolArcScale`. Resolving every group before coloring any is what
 * makes that possible at no extra cost: the expensive half already had to run
 * per group.
 *
 * Every group handed in is pooled, so a lane the display doesn't draw must not
 * be in the map: it would shift the scale the visible lanes share. That is the
 * caller's `rawDataByGroup`, which drops `hiddenGroupKeys` at the source
 * (`buildRawDataByGroup`) precisely so no walk of it — this one included — has
 * to re-apply the rule.
 */
export function computeArcsByGroup(
  rawDataByGroup: ReadonlyMap<string, Map<number, WorkerPileupData>>,
  regions: ArcRegions,
  settings: ArcSettings,
): ArcsByGroupResult {
  // Each group carries its own collected input rather than sitting in a second
  // array indexed in step with this one: the pooling in between is the whole
  // reason collection and resolution are separate passes, and two parallel
  // arrays make "same index" an invariant to hold rather than one to read.
  const groups = [...rawDataByGroup].map(([key, rawMap]) => ({
    key,
    input: collectArcInputs(rawMap, regions.loaded, settings),
  }))
  const scale = poolArcScale(groups.map(g => g.input))
  const byGroup = new Map<string, Map<number, ArcsUploadData>>()
  const crossRegionByGroup = new Map<string, CrossRegionArc[]>()
  const inkGroupKeys = new Set<string>()
  const colorSlots = new Set<number>()
  let maxFlatArcSpanBp = 0
  for (const { key, input } of groups) {
    const { arcs, crossRegion, lines } = resolveArcs(
      input.pendingArcs,
      scale,
      settings,
      regions,
    )
    // The per-region feed is keyed on the LOADED list, unchanged: it is what a
    // block draws from, and a displayed region whose fetch has not landed has
    // no block to draw.
    const regionMap = arcsToRegionMap({ arcs, lines }, regions.loaded)
    byGroup.set(key, regionMap)
    crossRegionByGroup.set(key, crossRegion)

    // The cross-group facts, over BOTH halves and AFTER regionization — see
    // `ArcsByGroupResult`.
    let hasInk = crossRegion.length > 0
    for (const data of regionMap.values()) {
      if (hasArcBandInk(data)) {
        hasInk = true
      }
      for (const ct of data.arcColorTypes) {
        colorSlots.add(ct)
      }
      // A tick carries no per-instance colour — every one of them is
      // ARC_COLOR_INTERCHROM (arcLine.slang) — so their presence, not a scan of
      // their colours, is what keys the swatch.
      if (data.numArcLines > 0) {
        colorSlots.add(ARC_COLOR_INTERCHROM)
      }
      if (data.maxFlatArcSpanBp > maxFlatArcSpanBp) {
        maxFlatArcSpanBp = data.maxFlatArcSpanBp
      }
    }
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
