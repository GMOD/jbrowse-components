import { readNameAt, spanOf } from '@jbrowse/alignments-core'
import { discordantDipPx } from '@jbrowse/sv-core'

import { arcSlotCategory } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051).
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import { isPlacedRead } from '../../shared/placedReads.ts'
import { passesCategory } from '../../shared/readCategoryFilters.ts'
import {
  crossesChromosomes,
  isGpuLinkedReadLine,
  iterLinkedPairs,
  linkedReadLinesByRegion,
} from './compute.ts'

import type { LaidOutPileupData } from '../../RenderAlignmentDataRPC/types.ts'
import type { ArcCategory } from '../../shaders/palettes.ts'
import type { ConnectionFilter } from '../../shared/types.ts'
import type { CanonicalRefName } from '../arcs/arcTypes.ts'
import type { LinkedPair, RefNameAt } from './compute.ts'
import type { LinkedReadLinesUploadData } from './types.ts'

// The split view's alignment connector width, which draws the same curve.
export const CURVE_STROKE_WIDTH_PX = 1

// Every pair the line pass leaves: it cannot dash a line or name the loci a
// junction skips.
function isConnectorMarkPair(pair: LinkedPair) {
  return !isGpuLinkedReadLine(pair)
}

/** The connection colors the connectors' color types paint. */
export function connectorCategories(colorTypes: Iterable<number>) {
  const categories = new Set<ArcCategory>()
  for (const colorType of colorTypes) {
    categories.add(arcSlotCategory(linkedReadColorSlot(colorType)))
  }
  return categories
}

// The connector-mark pairs of a laid-out region map, which the connector feed
// (`buildConnectorFeeds`) turns into the mark's channels: every pair the
// straight-line pass does not draw. A model getter memoizes it, so it reruns on
// a relayout and never on a scroll or pan.
//
// The SA parse behind `hiddenSegmentsBetween` belongs here for the same reason:
// it is per read GROUP and scroll-invariant, so the memo pays it once per
// relayout instead of once per frame. Only a group with two segments on one mate
// reaches it at all — a plain pair partitions to one segment per side and
// allocates nothing — which is what keeps it off the deep short-read path.
export function enumerateConnectorPairs(
  laidOutPileupMap: ReadonlyMap<number, LaidOutPileupData>,
  canonicalRefName?: CanonicalRefName,
  refNameAt?: RefNameAt,
): LinkedPair[] {
  const out: LinkedPair[] = []
  for (const pair of iterLinkedPairs(
    laidOutPileupMap,
    canonicalRefName,
    refNameAt,
  )) {
    if (isConnectorMarkPair(pair)) {
      out.push(pair)
    }
  }
  return out
}

/**
 * Whether the connectors draw a pair under `connectionFilter`, by the test
 * the arc band applies to the same connection. A connector joins two laid-out
 * reads, so it is never an off-screen mate, and it crosses chromosomes when
 * its two ends' regions do. A connection that paints inter-chromosomal (its
 * ends cross chromosomes, or its records name a mate on another, as the band
 * tests it) draws only between placed records
 * (`isPlacedRead`), and a mate link only when the band's collection
 * stage counted `minInterchromReads` at its breakpoint, the QNAMEs
 * `belowFloor` returns; a split read is exempt from that floor, as on the band.
 */
export function connectorFilterOf(
  { interchrom, offscreenMates, minInterchromReads }: ConnectionFilter,
  refNameAt: RefNameAt,
  belowFloor: () => ReadonlySet<string>,
) {
  return ({ e1, e2, c }: LinkedPair) => {
    const crosses = crossesChromosomes(e1, e2, refNameAt)
    const paintsInterchrom = crosses || c.interchrom
    return (
      passesCategory(paintsInterchrom, interchrom) &&
      passesCategory(false, offscreenMates) &&
      !(paintsInterchrom && !(isPlacedRead(e1) && isPlacedRead(e2))) &&
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
  // the pairs those records draw
  linePairs: LinkedPair[]
  // what the overlay draws
  overlayPairs: LinkedPair[]
}

const NO_LINES: ReadonlyMap<number, LinkedReadLinesUploadData> = new Map()

// Every connector of one group, from one walk of its reads: the straight-line
// pass takes `isGpuLinkedReadLine` pairs when `lines` is on, and the overlay
// the rest. `admits` (`connectorFilterOf`) drops a pair from both.
//
// `canonicalRefName` turns on the SA walk that finds hidden segments; without
// it no pair has any, and a junction across unfetched segments would be drawn
// solid by the line pass as well as dashed by the overlay.
export function resolveConnectors(
  map: ReadonlyMap<number, LaidOutPileupData>,
  {
    lines,
    canonicalRefName,
    refNameAt,
    admits,
  }: {
    lines: boolean
    canonicalRefName?: CanonicalRefName
    // what tells a connection crossing chromosomes, which paints
    // inter-chromosomal as its arc does
    refNameAt?: RefNameAt
    admits?: (pair: LinkedPair) => boolean
  },
): GroupConnectors {
  if (!lines) {
    const pairs = enumerateConnectorPairs(map, canonicalRefName, refNameAt)
    return {
      lines: NO_LINES,
      linePairs: [],
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
    linePairs: straight,
    overlayPairs: rest,
  }
}

// `resolveConnectors` over every group when the connectors draw, and nothing
// at all when they do not. A group whose reads share one row draws no straight
// lines, which would lie along that row.
export function resolveConnectorsByGroup(
  byGroup: ReadonlyMap<string, ReadonlyMap<number, LaidOutPileupData>>,
  {
    draws,
    ...opts
  }: Omit<Parameters<typeof resolveConnectors>[1], 'lines'> & {
    draws: boolean
  },
  stacksRows: (key: string) => boolean,
) {
  const out = new Map<string, GroupConnectors>()
  if (draws) {
    for (const [key, map] of byGroup) {
      out.set(key, resolveConnectors(map, { ...opts, lines: stacksRows(key) }))
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
// position; the mark draws a dip shallower where its ends sit closer on screen
// than its depth.
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
// tall ones. A set depth, where a discordant dip grows with the distance
// spanned and would carry a long duplication's loop across every row below;
// zoomed out, the mark shrinks it with its ends like any other dip.
export const LOOP_MIN_DIP_PX = 10
export const LOOP_MAX_DIP_PX = 28
export const LOOP_STROKE_WIDTH_PX = 2
// Rows thinner than this have no room for an arrowhead.
export const LOOP_ARROW_MIN_FEATURE_HEIGHT_PX = 5
export const LOOP_MAX_ARROW_PX = 8

/** How deep a maps-back loop dips under its row at a row pitch of `rowPitch`. */
export function loopDipPx(rowPitch: number) {
  return Math.min(LOOP_MAX_DIP_PX, Math.max(LOOP_MIN_DIP_PX, 4 * rowPitch))
}
