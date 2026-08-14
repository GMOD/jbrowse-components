import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051) —
// the same one `computePileupBezierArcs` resolves its connector colours through,
// which is what makes an aggregated arc the colour of the fan it summarizes.
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { connectionLabel, iterLinkedPairs } from '../linkedReads/compute.ts'
import { sashimiArcGeometry } from './arcGeometry.ts'

import type { PileupDataResult } from '../../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { SashimiArc, SashimiBandHeights } from './arcGeometry.ts'

// Split-read junctions as COUNTED arcs, drawn into the sashimi bands.
//
// The bezier connection overlay already draws split reads, but it draws one
// curve per molecule: a fusion supported by 200 reads is 200 near-identical
// curves, and the picture can say a junction is here without saying how many
// molecules agree. That is the same problem `resolveArcs` solved for the arc
// band (coalesce, then spend the count on stroke width) and the same shape
// sashimi has always drawn for splice junctions (one arc, thickness and a label
// from the read count). This is those two joined: the fan stays in the pileup,
// and one arc over the coverage band carries the count.
//
// What neither existing path could express, and why this is a third producer
// rather than a setting on one of them:
//
//   - sashimi's source is the coverage pipeline's `skip` CIGAR ops, so it never
//     sees an SA junction at all, and its `MergedJunction` carries one refName —
//     a fusion junction is not merely unimplemented there, it is inexpressible;
//   - the arc band refuses an interchromosomal arc by construction
//     (`resolveArcs` pushes a tick on each endpoint instead), because insert
//     size and pair orientation are meaningless across refs. That rule is right
//     for a mate link and wrong for a split read: the molecule physically
//     crosses the junction, so there IS a curve to draw.
//
// Both ends resolve through their own `displayedRegionIndex`, which is what
// lets one arc span two displayed regions — a chr22 half and a chr9 half of one
// view, the BCR-ABL layout the tutorial's k562_bcr_abl_split figure uses.

export interface SplitJunctionEnd {
  displayedRegionIndex: number
  refName: string
  bp: number
}

export interface MergedSplitJunction {
  // Unique within one group's junction set: the two ends' region indices and
  // representative coordinates, plus the connection type they were bucketed
  // under. Region INDEX rather than refName, because one refName can be shown as
  // two displayed regions and the two halves of a foldback then key alike.
  key: string
  e1: SplitJunctionEnd
  e2: SplitJunctionEnd
  // Molecules crossing this junction. One per read, not one per alignment:
  // `iterLinkedPairs` chains a read's segments after `dedupeByReadId` has
  // collapsed the copies a read overlapping two regions arrives as.
  count: number
  // LINKED_READ_COLOR_*, from the two segments' strands — the same classifier
  // and therefore the same tint the bezier connectors below the arc are drawn
  // with.
  colorType: number
}

// Endpoints scatter. A clean junction has every read reporting the same two
// coordinates, but microhomology at the breakpoint, a soft-clip the aligner
// placed a base or two differently, and small indels near the join all move an
// endpoint by a few bp — and an exact-coordinate key then splits one junction
// into a spray of singletons, which is precisely the picture this exists to
// replace. `clusteredInterchromSupport` (features/arcs) hit the same wall from
// the other side and its comment says why an exact count is 1 for essentially
// every interchromosomal connection.
//
// The window is deliberately small and NOT a fragment length: unlike a mate
// pair, which merely straddles a breakpoint, a split read's alignment ENDS at
// it, so the coordinate is the aligner's own call and the scatter is
// base-scale, not fragment-scale. Too wide a window merges genuinely distinct
// junctions — alternative splice acceptors, two nearby breakpoints of one
// complex event — which is the failure that cannot be seen in the picture,
// since the merged arc looks exactly like a real one.
export const DEFAULT_SPLIT_JUNCTION_WINDOW_BP = 10

interface Site {
  bp1: number
  bp2: number
  count: number
}

interface Bucket {
  r1: number
  r2: number
  colorType: number
  sites: Map<string, Site>
}

// Cluster one bucket's exact sites into junctions, HEAVIEST FIRST so a
// cluster's representative is its modal site.
//
// That ordering is the whole design. The alternative — averaging, or taking the
// leftmost — invents a coordinate no read reported, which is what `arcKey`'s
// exact-coordinate rule refuses for the arc band and is worse here, where the
// arc is the figure's claim about where a fusion joins. Heaviest-first makes the
// drawn position the one the most molecules actually agreed on, and the scatter
// around it merely adds to the count.
//
// O(n*k) over sites × clusters, both small: this runs over already-merged exact
// sites within one (region pair, connection type) bucket.
function clusterSites(sites: Iterable<Site>, windowBp: number) {
  const ordered = [...sites].sort(
    (a, b) => b.count - a.count || a.bp1 - b.bp1 || a.bp2 - b.bp2,
  )
  const clusters: Site[] = []
  for (const site of ordered) {
    const hit = clusters.find(
      c =>
        Math.abs(c.bp1 - site.bp1) <= windowBp &&
        Math.abs(c.bp2 - site.bp2) <= windowBp,
    )
    if (hit) {
      hit.count += site.count
    } else {
      clusters.push({ ...site })
    }
  }
  return clusters
}

export interface MergeSplitJunctionsOpts {
  laidOutPileupMap: ReadonlyMap<number, PileupDataResult>
  displayedRegions: { refName: string }[]
  windowBp: number
  // Junctions under this many supporting molecules are dropped.
  minScore: number
}

/**
 * One counted junction per distinct split-read breakpoint in this group.
 *
 * Pan- and scroll-invariant — no screen coordinate is read — so a model getter
 * can memoize it across scroll and only the projection in
 * `computeSplitJunctionArcs` reruns per frame. Same split as
 * `enumerateBezierPairs` / `computePileupBezierArcs`, and for the same reason:
 * the read walk is the allocation-heavy half.
 */
export function mergeSplitJunctions({
  laidOutPileupMap,
  displayedRegions,
  windowBp,
  minScore,
}: MergeSplitJunctionsOpts): MergedSplitJunction[] {
  const buckets = new Map<string, Bucket>()
  for (const { e1, e2, c } of iterLinkedPairs(laidOutPileupMap)) {
    if (!c.isSplit) {
      continue
    }
    // Canonical end order, so one junction is one bucket however the molecule
    // that reported it was sequenced. `iterLinkedPairs` orders a read's segments
    // 5'→3' ALONG THE READ, so a fusion sequenced from the other strand hands
    // back the identical junction with its two ends swapped — two arcs at one
    // locus, each with half the count. (The connection type survives the swap on
    // its own: `splitJunctionKind` compares the two strands to each other.)
    const flip =
      e2.displayedRegionIndex < e1.displayedRegionIndex ||
      (e2.displayedRegionIndex === e1.displayedRegionIndex && c.bp2 < c.bp1)
    const r1 = flip ? e2.displayedRegionIndex : e1.displayedRegionIndex
    const r2 = flip ? e1.displayedRegionIndex : e2.displayedRegionIndex
    const bp1 = flip ? c.bp2 : c.bp1
    const bp2 = flip ? c.bp1 : c.bp2
    if (!displayedRegions[r1] || !displayedRegions[r2]) {
      continue
    }
    const bucketKey = `${r1}\0${r2}\0${c.colorType}`
    let bucket = buckets.get(bucketKey)
    if (!bucket) {
      bucket = { r1, r2, colorType: c.colorType, sites: new Map() }
      buckets.set(bucketKey, bucket)
    }
    const siteKey = `${bp1}\0${bp2}`
    const site = bucket.sites.get(siteKey)
    if (site) {
      site.count++
    } else {
      bucket.sites.set(siteKey, { bp1, bp2, count: 1 })
    }
  }

  const out: MergedSplitJunction[] = []
  for (const { r1, r2, colorType, sites } of buckets.values()) {
    for (const cluster of clusterSites(sites.values(), windowBp)) {
      if (cluster.count < minScore) {
        continue
      }
      out.push({
        key: `${r1}:${cluster.bp1}:${r2}:${cluster.bp2}:${colorType}`,
        e1: {
          displayedRegionIndex: r1,
          refName: displayedRegions[r1]!.refName,
          bp: cluster.bp1,
        },
        e2: {
          displayedRegionIndex: r2,
          refName: displayedRegions[r2]!.refName,
          bp: cluster.bp2,
        },
        count: cluster.count,
        colorType,
      })
    }
  }
  return out
}

export interface ComputeSplitJunctionArcsOpts {
  junctions: MergedSplitJunction[]
  bpToScreenX: (
    refName: string,
    bp: number,
    displayedRegionIndex?: number,
  ) => number | undefined
  heights: SashimiBandHeights
  // The themed palette, for the same reason the connectors take one: a baked
  // module palette drew arcs in light-mode colours over dimmed dark-mode reads.
  colors: ColorPalette
}

// Project merged junctions to band-local arc geometry. Emitted as `SashimiArc`
// so the overlay, the SVG export, the label pass, the tooltip and the selection
// key all handle them unchanged — the two producers differ in what they know
// about a junction, not in how it is drawn.
//
// ALWAYS the 'up' band, unlike splice arcs, which `sashimiArcsMode` can send
// down. The down strip only exists where the LAYOUT reserved it
// (`sashimiDownKeysByGroup`), and an arc sent into an unreserved strip paints
// over the top of the pileup — so offering the choice here means teaching that
// reservation about a second junction set, which is a layout change and not a
// geometry one. Up costs nothing and composes: the fan stays in the pileup and
// the counted arc rides over the coverage histogram above it.
export function computeSplitJunctionArcs({
  junctions,
  bpToScreenX,
  heights,
  colors,
}: ComputeSplitJunctionArcsOpts): SashimiArc[] {
  const palette = buildLinkedReadColorPalette(colors)
  const arcs: SashimiArc[] = []
  for (const { e1, e2, count, colorType } of junctions) {
    // Region index, not just refName: the two ends can sit in two different
    // displayed regions that share a refName, and resolving by name alone draws
    // both ends in the first of them (a zero-length arc).
    const x1 = bpToScreenX(e1.refName, e1.bp, e1.displayedRegionIndex)
    const x2 = bpToScreenX(e2.refName, e2.bp, e2.displayedRegionIndex)
    if (x1 === undefined || x2 === undefined) {
      continue
    }
    arcs.push({
      ...sashimiArcGeometry({
        x1,
        x2,
        // Two chromosomes have no distance between them — see
        // `arcHeightFraction`, which draws that case at full height.
        genomicSpan:
          e1.refName === e2.refName ? Math.abs(e2.bp - e1.bp) : undefined,
        count,
        side: 'up',
        heights,
      }),
      stroke: rgb255(palette[linkedReadColorSlot(colorType)]!),
      start: e1.bp,
      end: e2.bp,
      refName: e1.refName,
      endRefName: e2.refName,
      score: count,
      // A split junction has no single strand: it is a join between two
      // segments whose strands may differ, and that difference is already the
      // connection type carrying the tint. 0 is the "no strand" value the
      // tooltip omits its strand row for.
      strand: 0,
      title: connectionLabel(colorType),
    })
  }
  return arcs
}
