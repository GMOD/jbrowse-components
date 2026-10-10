import { spanOf } from '@jbrowse/alignments-core'
import { BEZIER_CONNECTOR_MAX_REACH_PX } from '@jbrowse/core/util'
import { discordantDipPx } from '@jbrowse/sv-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051).
// Canvas2D/SVG spelled it `colorType % palette.length`, which agrees with the
// shader's clamp on every slot in use and resolves an out-of-range one to a
// different real color instead of the last slot.
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import {
  LINKED_READ_COLOR_MAPS_BACK,
  connectionLabel,
  connectorPaletteSlot,
  isGpuLinkedReadLine,
  iterLinkedPairs,
  linkedReadLinesByRegion,
} from './compute.ts'

import type { SwatchCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { LaidOutPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { LinkedPair } from './compute.ts'
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
  declared?: Partial<Record<SwatchCategory, string>>,
): LegendItem[] {
  const palette = buildLinkedReadColorPalette(colors)
  const byColor = new Map<string, LegendItem>()
  for (const colorType of [...colorTypes].sort((a, b) => a - b)) {
    const color = rgb255(
      palette[linkedReadColorSlot(connectorPaletteSlot(colorType))]!,
    )
    // A maps-back split keeps a row beside the RL pairs it shares a color
    // with, whose label describes mates.
    const key =
      colorType === LINKED_READ_COLOR_MAPS_BACK ? `${color} split` : color
    if (!byColor.has(key)) {
      byColor.set(key, {
        color,
        label: connectionLabel(colorType, declared),
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
