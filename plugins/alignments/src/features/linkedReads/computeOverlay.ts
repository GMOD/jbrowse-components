import { readIdAt, readNameAt } from '@jbrowse/alignments-core'
import {
  BEZIER_CONNECTOR_MAX_REACH_PX,
  bezierConnectorPath,
} from '@jbrowse/core/util'
import { HIDDEN_SEGMENT_DASH, discordantDipPx } from '@jbrowse/sv-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051).
// Canvas2D/SVG spelled it `colorType % palette.length`, which agrees with the
// shader's clamp on every slot in use and resolves an out-of-range one to a
// different real color instead of the last slot.
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { LINKED_READ_LINE_WIDTH_PX } from '../../shaders/slang/linkedReadLine.consts.generated.ts'
import {
  connectionLabel,
  isGpuLinkedReadLine,
  iterLinkedPairs,
  linkedReadLinesByRegion,
} from './compute.ts'

import type { LaidOutPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { LinkedPair, ReadEntry } from './compute.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

// The split view's alignment connector width, which draws the same curve.
const CURVE_STROKE_WIDTH_PX = 1

// Cull by endpoint Y, padded by the shaping's reach: a curve dips below or bows
// above its endpoints (see bezierConnector), so a connector whose reads have
// both scrolled just past an edge can still have a visible body. The pad stays
// the CONSTANT even though a dip is now scaled by the band: core clamps every
// dip to it, so it still bounds the reach, and a pad derived from this section's
// band would be the same number on any band deep enough to matter.
function arcIsVisible(
  sy1: number,
  sy2: number,
  viewportTop: number,
  viewportBottom: number,
) {
  const reach = BEZIER_CONNECTOR_MAX_REACH_PX
  return (
    Math.min(sy1, sy2) - reach < viewportBottom &&
    Math.max(sy1, sy2) + reach > viewportTop
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
  // A straight connector strokes at the line pass's width, which draws the same
  // connection when both ends share a region; a curve at the split view's.
  strokeWidth: number
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

// Every pair the line pass leaves: it cannot dash a line or name the loci a
// junction skips.
function isBezierArcPair(pair: LinkedPair) {
  return !isGpuLinkedReadLine(pair)
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
// built from the same palette and labels the overlay itself uses
// (linkedReadColorPalette + connectionLabel) so the on-screen key can never
// disagree with what's drawn. `colorTypes` is the set of LINKED_READ_COLOR_*
// present in view; sorted so the legend order is stable as reads stream in.
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

export interface GroupConnectors {
  // the straight-line pass's records, by displayed region index
  lines: ReadonlyMap<number, LinkedReadLinesUploadData>
  // what the overlay draws
  overlayPairs: LinkedPair[]
}

const NO_LINES: ReadonlyMap<number, LinkedReadLinesUploadData> = new Map()

// Every connector of one group, from one walk of its reads: the straight-line
// pass takes `isGpuLinkedReadLine` pairs when `lines` is on, and the overlay
// what its scope admits of the rest.
//
// `canonicalRefName` turns on the SA walk that finds hidden segments; without
// it no pair has any, and a junction across unfetched segments would be drawn
// solid by the line pass as well as dashed by the overlay.
export function resolveConnectors(
  map: ReadonlyMap<number, LaidOutPileupData>,
  {
    lines,
    scope,
    canonicalRefName,
  }: {
    lines: boolean
    scope: BezierArcScope
    canonicalRefName?: CanonicalRefName
  },
): GroupConnectors {
  if (!lines) {
    return {
      lines: NO_LINES,
      overlayPairs: enumerateBezierPairs(map, scope, canonicalRefName),
    }
  }
  const straight: LinkedPair[] = []
  const rest: LinkedPair[] = []
  for (const pair of iterLinkedPairs(map, canonicalRefName)) {
    ;(isGpuLinkedReadLine(pair) ? straight : rest).push(pair)
  }
  return {
    lines: linkedReadLinesByRegion(straight),
    overlayPairs:
      scope === 'all'
        ? rest
        : scope === 'crossRegion'
          ? rest.filter(isCrossRegionPair)
          : [],
  }
}

// `resolveConnectors` over every group, and nothing at all when neither the
// line pass nor the overlay draws. A group whose reads share one row draws no
// straight lines, which would lie along that row.
export function resolveConnectorsByGroup(
  byGroup: ReadonlyMap<string, ReadonlyMap<number, LaidOutPileupData>>,
  opts: Parameters<typeof resolveConnectors>[1],
  stacksRows: (key: string) => boolean,
) {
  const out = new Map<string, GroupConnectors>()
  if (opts.lines || opts.scope !== 'none') {
    for (const [key, map] of byGroup) {
      out.set(
        key,
        resolveConnectors(map, {
          ...opts,
          lines: opts.lines && stacksRows(key),
        }),
      )
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
  // The section's laid-out pileup band height, which scales a discordant
  // connector's dip and bounds the room left below the reads it joins. A layout
  // quantity on purpose: `clipBottom - clipTop`
  // moves as the reader scrolls (bandScreenTop is sticky while the band bottom
  // clamps to the canvas), and keying depth on it would put the depth back on
  // the scroll position.
  pileupHeight: number
  scrollTop: number
  // Screen-y of this section's pileup clip top and band bottom, the edges the
  // visibility cull keeps a curve between.
  viewportTop: number
  viewportBottom: number
  // The themed palette, for the same reason the read fills take one: a baked
  // module palette drew connectors in light-mode colors over dimmed dark-mode
  // reads.
  colors: ColorPalette
}

// Bezier curves for aberrant pairs, plus straight `M..L..` paths for
// cross-region normal pairs. Within-region normal pairs are rendered by the
// GPU + Canvas2D pipelines and are already absent from `pairs`, which
// `resolveConnectors` narrows to what this draws. Purely a projection of
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
    pileupHeight,
    scrollTop,
    viewportTop,
    viewportBottom,
    colors,
  } = opts
  const linkedReadPalette = buildLinkedReadColorPalette(colors)

  const rowH = featureHeight + featureSpacing
  const readCenterDy = featureHeight / 2
  // Offset into the section's own band, so `pileupHeight` minus it is the room a
  // dip has below the read — the same layout tier as the band, with no scroll in
  // it. readScreenY projects it for drawing.
  const rowOffset = (e: ReadEntry) =>
    e.data.readYs[e.readIdx]! * rowH + readCenterDy
  const readScreenY = (e: ReadEntry) =>
    rowOffset(e) + pileupTopOffset - scrollTop

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

    if (!arcIsVisible(sy1, sy2, viewportTop, viewportBottom)) {
      continue
    }

    // A normal pair on one chromosome is a plain line and everything else dips
    // below the reads, matching BreakpointSplitView; a straight line across
    // chromosomes would be the one mark calling a translocation normal. A
    // hidden-segment line whose ends share a row, as a chain's do, would lie
    // on the chain's connecting line, so it bows up over the row instead, as
    // the split view bows a same-level normal link.
    const hidden = !!hiddenSegmentsBetween?.length
    const sameRef = r1.refName === r2.refName
    const plain = c.isNormal && sameRef
    const straight = plain && !(hidden && sy1 === sy2)
    const d = straight
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
          // The endpoint bps, not their screen xs, so one event holds its depth
          // while the reader zooms; no span at all for an interchromosomal pair.
          // The room is measured below the LOWER read, which is the one the
          // section's clip cuts first.
          dipPx: plain
            ? undefined
            : discordantDipPx({
                bandPx: pileupHeight,
                roomBelowPx:
                  pileupHeight - Math.max(rowOffset(e1), rowOffset(e2)),
                spanBp: sameRef ? Math.abs(c.bp2 - c.bp1) : undefined,
              }),
        })
    const stroke = rgb255(linkedReadPalette[linkedReadColorSlot(c.colorType)]!)

    result.push({
      d,
      stroke,
      label: connectionLabel(c.colorType),
      strokeWidth: straight ? LINKED_READ_LINE_WIDTH_PX : CURVE_STROKE_WIDTH_PX,
      // The id STRINGS, not the keys: these reach `selectFeatureById` and
      // `getFeatureInfoById`. One pair per drawn arc, not per read.
      id1: readIdAt(e1.data, e1.readIdx)!,
      id2: readIdAt(e2.data, e2.readIdx)!,
      readName: readNameAt(e1.data, e1.readIdx),
      x1: sx1,
      x2: sx2,
      dash: hidden ? HIDDEN_SEGMENT_DASH : undefined,
      hiddenSegmentsBetween,
    })
  }

  return result
}
