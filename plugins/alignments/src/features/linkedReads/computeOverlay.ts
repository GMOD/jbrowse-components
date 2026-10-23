import { readNameAt, spanOf } from '@jbrowse/alignments-core'
import { BEZIER_CONNECTOR_MAX_REACH_PX } from '@jbrowse/core/util'
import { discordantDipPx } from '@jbrowse/sv-core'

import { arcSlotCategory } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051).
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { getArcLegendItems } from '../../shared/legendUtils.ts'
import { passesCategory } from '../../shared/readCategoryFilters.ts'
import { connectorColorShift } from '../arcs/arcColors.ts'
import {
  crossesChromosomes,
  isGpuLinkedReadLine,
  iterLinkedPairs,
  linkedReadLinesByRegion,
} from './compute.ts'

import type { SwatchCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { LaidOutPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { ArcCategory } from '../../shaders/palettes.ts'
import type { ArcColorField, ConnectionFilter } from '../../shared/types.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { LinkedPair, RefNameAt } from './compute.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { LegendItem } from '@jbrowse/plugin-linear-genome-view'

// The split view's alignment connector width, which draws the same curve.
export const CURVE_STROKE_WIDTH_PX = 1

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
 * - `all` — the user ticked "Curved connectors", so it draws every
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

// Legend swatches for the connector colors in view, in the arc key's rows and
// wording, since the connectors paint as the arcs do: its inter-chromosomal row
// names split reads unless a mate link crosses too, as the arc key's does.
export function bezierConnectionLegendItems(
  colorTypes: Iterable<number>,
  colors: ColorPalette,
  colorField: ArcColorField,
  interchromFromMatePair: boolean,
  declared?: Partial<Record<SwatchCategory, string>>,
): LegendItem[] {
  const shift = connectorColorShift(colorField)
  const categories = new Set<ArcCategory>()
  for (const colorType of colorTypes) {
    categories.add(
      arcSlotCategory(linkedReadColorSlot(colorType, shift), colorField),
    )
  }
  return getArcLegendItems(categories, colors, interchromFromMatePair, declared)
}

// Enumerate the linked pairs of a laid-out region map, which the connector
// feed (`buildConnectorFeeds`) turns into the mark's channels. A model getter
// memoizes it, so it reruns on a relayout and never on a scroll or pan.
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
  refNameAt?: RefNameAt,
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
  for (const pair of iterLinkedPairs(
    laidOutPileupMap,
    canonicalRefName,
    refNameAt,
  )) {
    if (predicate(pair)) {
      out.push(pair)
    }
  }
  return out
}

/**
 * Whether the connectors draw a pair under `connectionFilter`, by the test
 * the arc band applies to the same connection. A connector joins two laid-out
 * reads, so it is never an off-screen mate, and it crosses chromosomes when
 * its two ends' regions do. Such a mate link draws only when the band's
 * collection stage counted `minInterchromReads` at its breakpoint, the QNAMEs
 * `belowFloor` returns; a split read is exempt, as on the band.
 */
export function connectorFilterOf(
  { interchrom, offscreenMates, minInterchromReads }: ConnectionFilter,
  refNameAt: RefNameAt,
  belowFloor: () => ReadonlySet<string>,
) {
  return ({ e1, e2, c }: LinkedPair) => {
    const crosses = crossesChromosomes(e1, e2, refNameAt)
    return (
      passesCategory(crosses, interchrom) &&
      passesCategory(false, offscreenMates) &&
      !(
        crosses &&
        !c.isSplit &&
        minInterchromReads > 1 &&
        belowFloor().has(readNameAt(e1.data, e1.readIdx))
      )
    )
  }
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
// what its scope admits of the rest. `admits` (`connectorFilterOf`) drops a
// pair from both.
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
    refNameAt,
    admits,
  }: {
    lines: boolean
    scope: BezierArcScope
    canonicalRefName?: CanonicalRefName
    // what tells a connection crossing chromosomes, which paints
    // inter-chromosomal as its arc does
    refNameAt?: RefNameAt
    admits?: (pair: LinkedPair) => boolean
  },
): GroupConnectors {
  if (!lines) {
    const pairs = enumerateBezierPairs(map, scope, canonicalRefName, refNameAt)
    return {
      lines: NO_LINES,
      overlayPairs: admits ? pairs.filter(admits) : pairs,
    }
  }
  const straight: LinkedPair[] = []
  const rest: LinkedPair[] = []
  for (const pair of iterLinkedPairs(map, canonicalRefName, refNameAt)) {
    if (!admits || admits(pair)) {
      ;(isGpuLinkedReadLine(pair) ? straight : rest).push(pair)
    }
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
  displayedRegions: readonly { refName: string; reversed?: boolean }[]
  featureHeight: number
  featureSpacing: number
  // The section's laid-out pileup band height, which is how deep a discordant
  // connector may dip: a layout quantity, so a scroll moves no depth.
  pileupHeight: number
}

// Left-to-right screen order without projecting, which answers nothing for the
// part of an alignment past its region's edge. The stride clears any uint32 bp
// in either direction.
const REGION_STRIDE = 2 ** 33

function screenOrder(
  displayedRegions: Opts['displayedRegions'],
  regionIndex: number,
  bp: number,
) {
  return (
    regionIndex * REGION_STRIDE +
    (displayedRegions[regionIndex]?.reversed ? -bp : bp)
  )
}

function screenStrand(strand: number, reversed: boolean | undefined) {
  return reversed ? -strand : strand
}

function crossesOwnAlignment(
  { e1, e2, c, segments }: LinkedPair,
  displayedRegions: Opts['displayedRegions'],
) {
  const row = e1.data.readYs[e1.readIdx]
  const a = screenOrder(displayedRegions, e1.displayedRegionIndex, c.bp1)
  const b = screenOrder(displayedRegions, e2.displayedRegionIndex, c.bp2)
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return segments.some(s => {
    if (s.data.readYs[s.readIdx] !== row) {
      return false
    }
    const { start, end } = spanOf(s)
    const p = screenOrder(displayedRegions, s.displayedRegionIndex, start)
    const q = screenOrder(displayedRegions, s.displayedRegionIndex, end)
    return Math.min(p, q) < hi && Math.max(p, q) > lo
  })
}

// How one pair is drawn, from the layout alone: nothing here reads a screen
// position, so the section layout can ask it before any curve is projected
// (`bezierDipReservePx`) and get the answer the overlay draws.
//
// A normal connection is a plain line and everything else dips below the
// reads. A same-strand split junction is normal on any pair of chromosomes,
// as its color says, so in chain layout it runs along the molecule's own
// row. On a row it shares with alignments of the read lying between its
// two ends, as on a fold-back, that line would paint over them, so it dips
// like a discordant one. A hidden-segment line whose ends share a row would
// lie on the chain's connecting line, so it bows up over the row instead.
// A split junction is judged by the way its two segments point on screen,
// so an inverted fusion viewed with one partner's region flipped reads
// straight across the seam.
export function connectorShape(
  pair: LinkedPair,
  r1: Opts['displayedRegions'][number],
  r2: Opts['displayedRegions'][number],
  displayedRegions: Opts['displayedRegions'],
  pileupHeight: number,
) {
  const { e1, e2, c, hiddenSegmentsBetween } = pair
  const hidden = !!hiddenSegmentsBetween?.length
  const sameRow = e1.data.readYs[e1.readIdx] === e2.data.readYs[e2.readIdx]
  const facesOneWay = c.isSplit
    ? screenStrand(c.s1, r1.reversed) === screenStrand(c.s2, r2.reversed)
    : c.isNormal
  // A read that maps back over itself dips under its own row like any other
  // unusual connection, by a set depth (`loopDipPx`).
  const loop = c.mapsBack && sameRow
  const plain =
    loop ||
    (facesOneWay && !(sameRow && crossesOwnAlignment(pair, displayedRegions)))
  return {
    hidden,
    loop,
    straight: plain && !loop && !(hidden && sameRow),
    // The endpoint bps, not their screen xs, so one event holds its depth
    // while the reader zooms; no span at all for an interchromosomal pair.
    // Undefined for a plain connection, which is a line or bows up.
    dipPx: plain
      ? undefined
      : discordantDipPx(
          pileupHeight,
          r1.refName === r2.refName ? Math.abs(c.bp2 - c.bp1) : undefined,
        ),
  }
}

// How far a maps-back loop dips under its row: four rows, so it clears the
// read's own bar, within bounds that keep it visible on thin rows and local on
// tall ones. A fixed depth, where a discordant dip grows with the distance
// spanned and would carry a long duplication's loop across every row below.
export const LOOP_MIN_DIP_PX = 10
export const LOOP_MAX_DIP_PX = 28
export const LOOP_STROKE_WIDTH_PX = 2
// Rows thinner than this have no room for an arrowhead.
export const LOOP_ARROW_MIN_FEATURE_HEIGHT_PX = 5
export const LOOP_MAX_ARROW_PX = 8

// Clearance under the deepest apex for the stroke, which a hover thickens.
const DIP_RESERVE_PAD_PX = 2

// How far below a section's pileup band its deepest dipping connector reaches,
// which the section reserves under its last row so that curve can finish
// (`computeStackedSections`). Zero when nothing dips, or when every dip ends
// inside the band.
//
// `pileupHeight` is the band WITHOUT this reserve, the same number the overlay
// hands the dip law, so reserving room changes no curve's depth. A cubic's
// extreme is at most its apex depth below the lower endpoint, and exactly that
// when the two ends share a row.
export function bezierDipReservePx({
  pairs,
  displayedRegions,
  featureHeight,
  featureSpacing,
  pileupHeight,
}: Pick<
  Opts,
  | 'pairs'
  | 'displayedRegions'
  | 'featureHeight'
  | 'featureSpacing'
  | 'pileupHeight'
>) {
  const rowH = featureHeight + featureSpacing
  let deepest = 0
  for (const pair of pairs) {
    const { e1, e2 } = pair
    const r1 = displayedRegions[e1.displayedRegionIndex]
    const r2 = displayedRegions[e2.displayedRegionIndex]
    if (r1 && r2) {
      const { dipPx } = connectorShape(
        pair,
        r1,
        r2,
        displayedRegions,
        pileupHeight,
      )
      if (dipPx !== undefined) {
        const lowerRow = Math.max(
          e1.data.readYs[e1.readIdx]!,
          e2.data.readYs[e2.readIdx]!,
        )
        deepest = Math.max(
          deepest,
          lowerRow * rowH +
            featureHeight / 2 +
            Math.min(dipPx, BEZIER_CONNECTOR_MAX_REACH_PX),
        )
      }
    }
  }
  return deepest > 0
    ? Math.max(0, Math.ceil(deepest + DIP_RESERVE_PAD_PX - pileupHeight))
    : 0
}
