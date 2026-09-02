import {
  BEZIER_CONNECTOR_MAX_REACH_PX,
  bezierConnectorPath,
} from '@jbrowse/core/util'
import { HIDDEN_SEGMENT_DASH } from '@jbrowse/sv-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051).
// Canvas2D/SVG spelled it `colorType % palette.length`, which agrees with the
// shader's clamp on every slot in use and resolves an out-of-range one to a
// different real color instead of the last slot.
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { readIdAt } from '../../shared/readIdentity.ts'
import { readNameAt } from '../../shared/readNameBlock.ts'
import { connectionLabel, connectionMark, iterLinkedPairs } from './compute.ts'

import type { LaidOutPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { LinkedPair, ReadEntry } from './compute.ts'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

// Cull by endpoint Y. The endpoints alone don't bound the curve — every curve
// this overlay draws is discordant, so it dips below them (see bezierConnector)
// — so pad by the shaping's reach. Without this, a connector whose reads have
// both scrolled just past an edge takes its visible body with it. The pad is
// applied to both edges though the curve only reaches downward, which is merely
// over-inclusive: it keeps a few culled arcs, never drops a visible one.
function arcIsVisible(sy1: number, sy2: number, viewportBottom: number) {
  const reach = BEZIER_CONNECTOR_MAX_REACH_PX
  return (
    Math.min(sy1, sy2) - reach < viewportBottom &&
    Math.max(sy1, sy2) + reach > 0
  )
}

export interface PileupArc {
  d: string
  stroke: string
  id1: string
  id2: string
  // The QNAME both ends share, so a hover can emphasize every arc of one read
  // the way the breakpoint split view thickens every junction of a chain.
  readName: string
  // Screen x of each endpoint, so a click can pick the nearer read.
  x1: number
  x2: number
  // Connection classification for the hover tooltip. An inverted split gets
  // its own color (colorSplitReadInversion), distinct from the RR-pair blue, so
  // the two are tellable apart at a glance; the tooltip names which evidence
  // produced the arc rather than overloading a second dimension onto the stroke.
  label: string
  // Set together, and only for a junction across unfetched segments: the dash
  // resolved HERE so the live overlay and the SVG export cannot disagree about
  // which arcs are dashed (the invariant this file's stroke constants exist
  // for), and the loci for the hover to name (`hiddenSegmentsNote`).
  dash?: string
  hiddenSegmentsBetween?: string[]
}

// Stable React key / selection identity for a bezier arc, shared by the live
// overlay and the SVG export so the two can't key differently (mirrors
// sashimiArcKey).
export function bezierArcKey(arc: Pick<PileupArc, 'id1' | 'id2'>) {
  return `${arc.id1}:${arc.id2}`
}

// A linked pair becomes an overlay arc unless it's a normal-orientation pair
// wholly within one region — those straight connectors are drawn by the GPU /
// Canvas2D pipeline, not here. Applied once, by `enumerateBezierPairs`, so the
// arc emitter (computePileupBezierArcs) and the legend
// (bezierConnectionColorTypes) work from one already-narrowed list and the key
// can never list a connection color the overlay didn't draw.
export function isBezierArcPair({ e1, e2, c }: LinkedPair): boolean {
  return !(c.isNormal && e1.displayedRegionIndex === e2.displayedRegionIndex)
}

// The two ends sit in different displayed regions, so no per-region pass can
// join them: each block clips to its own bp range and projects the far end off
// its edge. This overlay is the only one that resolves each end through its own
// region index, which is what makes it the fallback in `crossRegion` scope.
function isCrossRegionPair({ e1, e2 }: LinkedPair): boolean {
  return e1.displayedRegionIndex !== e2.displayedRegionIndex
}

/**
 * Which connections this overlay is responsible for.
 *
 * - `all` — the user ticked "Use curved connectors", so it draws every
 *   connection the GPU line pass doesn't own (`isBezierArcPair`).
 * - `crossRegion` — chain mode with that box unticked. Chain layout puts a
 *   chain's alignments on ONE row across displayed regions (`mergeChains`) but
 *   its connecting-line pass is per region and counts a chain's reads in that
 *   region alone, so a chain holding one alignment in each of two regions
 *   gets no line from either and the mode silently drops the link it exists to
 *   show. Everything inside a single region is already drawn by that pass, so
 *   this scope adds only the pairs that straddle a boundary.
 * - `none` — no overlay.
 */
export type BezierArcScope = 'all' | 'crossRegion' | 'none'

// Legend swatches for the connection types actually drawn as bezier/line arcs,
// built from the same palette, labels and straight-vs-curved rule the overlay
// itself uses (linkedReadColorPalette + connectionLabel + connectionMark) so the
// on-screen key can never disagree with what's drawn — including the glyph, now
// that a row can be drawn as the connector it names rather than as a square.
// `colorTypes` is the set of LINKED_READ_COLOR_* present in view; sorted so the
// legend order is stable as reads stream in.
//
// One row per COLOR, because two color types can resolve to one swatch and the
// pair that does is drawn together: slots 0 and 1 are both `pairLR` in
// LINKED_READ_SLOT_CATEGORY, so a view holding an LR mate link and one whose
// orientation the worker never computed listed the identical grey twice, under
// two names. The lower slot's wording wins, which is the neutral one — slot 0
// is `connectionLabel`'s "Read pair" precisely because calling that grey LR
// would assert an orientation nothing measured, and once the two share a row
// the grey really does cover both. The read/arc key resolves the same collision
// in `oneRowPerMeaning`; this list never passes through it.
export function bezierConnectionLegendItems(
  colorTypes: Iterable<number>,
  colors: ColorPalette,
): LegendItem[] {
  const palette = buildLinkedReadColorPalette(colors)
  const byColor = new Map<string, LegendItem>()
  for (const colorType of [...colorTypes].sort((a, b) => a - b)) {
    const color = rgb255(palette[linkedReadColorSlot(colorType)]!)
    if (!byColor.has(color)) {
      byColor.set(color, {
        color,
        label: connectionLabel(colorType),
        mark: connectionMark(colorType),
      })
    }
  }
  return [...byColor.values()]
}

// Enumerate the linked pairs of a laid-out region map: the scroll- and
// pan-invariant half of the overlay. Only the read grouping + connection
// resolution live here, so a model getter can memoize it (recompute on relayout
// only) while the per-frame screen projection stays in `computePileupBezierArcs`
// — the name→reads Map is no longer rebuilt on every scroll frame.
//
// The `crossRegion` short-circuit is what keeps that scope free where it can buy
// nothing: a pair needs two regions to straddle, so a section holding one is
// answered without the O(reads) grouping at all. That is the single-region view,
// i.e. almost every view — which matters because unlike `all`, this scope is not
// something the user opted into.
//
// Measured, since "not free at depth" was the open question when this scope was
// added: at 200k reads the short-circuit is 0.0ms, and the multi-region case
// that does enumerate is ~80ms (2 regions) / ~63ms (8 regions). Against the
// `buildLaidOutChainMap` relayout it runs beside — 587ms and 1317ms on the same
// inputs — that is +13% and +5%. So it is real but not the thing to attack in
// this path, and it did not warrant a cheaper multi-region-name pre-pass.
//
// The SA parse behind `hiddenSegmentsBetween` belongs here for the same reason:
// it is per read GROUP and scroll-invariant, so the memo pays it once per
// relayout instead of once per frame. Only a group with two segments on one mate
// reaches it at all — a plain pair partitions to one segment per side and
// allocates nothing — which is what keeps it off the deep short-read path.
export function enumerateBezierPairs(
  laidOutPileupMap: ReadonlyMap<number, LaidOutPileupData>,
  scope: BezierArcScope = 'all',
  canonicalRefName?: CanonicalRefName,
): LinkedPair[] {
  if (
    scope === 'none' ||
    (scope === 'crossRegion' && laidOutPileupMap.size < 2)
  ) {
    return []
  }
  // The scope's own predicate, applied HERE rather than at each consumer, so
  // what this returns is exactly what the overlay draws. Both consumers (the arc
  // emitter and the legend) used to re-apply `isBezierArcPair` themselves, which
  // left the memoized `bezierPairSections` holding every ordinary within-region
  // pair — the overwhelming majority at depth under the `all` scope — for both
  // of them to skip. `crossRegion` needs no second gate: two ends in different
  // regions can never be the within-region normal pair `isBezierArcPair` drops,
  // so it is the narrower of the two.
  const predicate =
    scope === 'crossRegion' ? isCrossRegionPair : isBezierArcPair
  const out: LinkedPair[] = []
  for (const pair of iterLinkedPairs(laidOutPileupMap, canonicalRefName)) {
    if (predicate(pair)) {
      out.push(pair)
    }
  }
  return out
}

interface Opts {
  pairs: LinkedPair[]
  displayedRegions: { refName: string; reversed?: boolean }[]
  bpToScreenX: (
    refName: string,
    bp: number,
    displayedRegionIndex?: number,
  ) => number | undefined
  featureHeight: number
  featureSpacing: number
  pileupTopOffset: number
  scrollTop: number
  // Screen-y of this section's band bottom — the visibility cull's lower edge.
  viewportBottom: number
  // The themed palette, for the same reason the read fills take one: a baked
  // module palette drew connectors in light-mode colors over dimmed dark-mode
  // reads.
  colors: ColorPalette
}

// Bezier curves for aberrant pairs, plus straight `M..L..` paths for
// cross-region normal pairs. Within-region normal pairs are rendered by the
// GPU + Canvas2D pipelines and are already absent from `pairs`, which
// `enumerateBezierPairs` narrows to what this draws. Purely a projection of
// those pairs to screen space — the only scroll/pan-dependent half, and the only
// thing it drops is what falls outside the frame.
export function computePileupBezierArcs(opts: Opts): PileupArc[] {
  const {
    pairs,
    displayedRegions,
    bpToScreenX,
    featureHeight,
    featureSpacing,
    pileupTopOffset,
    scrollTop,
    viewportBottom,
    colors,
  } = opts
  const linkedReadPalette = buildLinkedReadColorPalette(colors)

  const rowH = featureHeight + featureSpacing
  const readCenterDy = featureHeight / 2
  const readScreenY = (e: ReadEntry) =>
    e.data.readYs[e.readIdx]! * rowH +
    pileupTopOffset -
    scrollTop +
    readCenterDy

  const result: PileupArc[] = []

  for (const { e1, e2, c, hiddenSegmentsBetween } of pairs) {
    const r1 = displayedRegions[e1.displayedRegionIndex]
    const r2 = displayedRegions[e2.displayedRegionIndex]
    if (!r1 || !r2) {
      continue
    }
    // Region index, not just refName: the two ends of a pair can sit in two
    // different displayed regions that share a refName, and resolving by name
    // alone would draw both ends in the first of them (a zero-length arc).
    const sx1 = bpToScreenX(r1.refName, c.bp1, e1.displayedRegionIndex)
    const sx2 = bpToScreenX(r2.refName, c.bp2, e2.displayedRegionIndex)
    if (sx1 === undefined || sx2 === undefined) {
      continue
    }

    const sy1 = readScreenY(e1)
    const sy2 = readScreenY(e2)

    if (!arcIsVisible(sy1, sy2, viewportBottom)) {
      continue
    }

    // Normal-orientation pairs draw as a plain line (the within-region ones
    // never reach here — the GPU / Canvas2D pipeline owns those). Everything
    // curving here is therefore discordant, so it dips, matching
    // BreakpointSplitView: a line is normal, a curve below the reads is not.
    // A same-strand split junction between two chromosomes keeps its strand
    // label but not the line: the split view curves every cross-ref connection
    // and the arc band draws none, so a straight line across chromosomes would
    // be the one mark calling a translocation normal.
    // Endpoint 2 is a split junction's 5' leading edge (folds back) for a split
    // read, or the mate's 3' edge for a pair.
    const d =
      c.isNormal && r1.refName === r2.refName
        ? `M ${sx1} ${sy1} L ${sx2} ${sy2}`
        : bezierConnectorPath({
            x1: sx1,
            y1: sy1,
            x2: sx2,
            y2: sy2,
            s1: c.s1,
            s2: c.s2,
            leadingEnd2: c.isSplit,
            reversed1: !!r1.reversed,
            reversed2: !!r2.reversed,
            dip: true,
          })
    const stroke = rgb255(linkedReadPalette[linkedReadColorSlot(c.colorType)]!)

    result.push({
      d,
      stroke,
      label: connectionLabel(c.colorType),
      // The id STRINGS, not the keys: these reach `selectFeatureById` and
      // `getFeatureInfoById`. One pair per drawn arc, not per read.
      id1: readIdAt(e1.data, e1.readIdx)!,
      id2: readIdAt(e2.data, e2.readIdx)!,
      readName: readNameAt(e1.data, e1.readIdx),
      x1: sx1,
      x2: sx2,
      dash: hiddenSegmentsBetween?.length ? HIDDEN_SEGMENT_DASH : undefined,
      hiddenSegmentsBetween,
    })
  }

  return result
}
