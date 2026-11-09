import { readIdAt, readNameAt } from '@jbrowse/alignments-core'
import {
  normalizedRgbToABGR,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import {
  CONNECTOR_ARROW,
  CONNECTOR_BOW,
  CONNECTOR_DASHED,
  CONNECTOR_LEADING_2,
  CONNECTOR_MINUS_1,
  CONNECTOR_MINUS_2,
  CONNECTOR_STRAIGHT,
} from '@jbrowse/render-core/shaders/connectorMarkConsts'

import {
  arcSlotCategory,
  buildArcColorPalette,
} from '../../shaders/palettes.ts'
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import {
  LINKED_READ_LINE_ALPHA,
  LINKED_READ_LINE_WIDTH_PX,
} from '../../shaders/slang/linkedReadLine.consts.generated.ts'
import { arcColorCategoryLabel } from '../../shared/legendUtils.ts'
import {
  CURVE_STROKE_WIDTH_PX,
  LOOP_ARROW_MIN_FEATURE_HEIGHT_PX,
  LOOP_MAX_ARROW_PX,
  LOOP_STROKE_WIDTH_PX,
  connectorShape,
  loopDipPx,
} from './computeOverlay.ts'

import type { SwatchCategory } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { LinkedPair } from './compute.ts'
import type { ConnectorChannels } from '@jbrowse/render-core/marks'

/** What a hover or click on connector `i` acts on and names. */
export interface ConnectorHit {
  id1: string
  id2: string
  readName: string
  label: string
  hiddenSegmentsBetween?: string[]
}

/** One region's connectors as the connector mark reads them, and their reads. */
export interface ConnectorFeed {
  channels: ConnectorChannels
  hits: ConnectorHit[]
}

class Lanes {
  x: number[] = []
  x2: number[] = []
  x2Region: number[] = []
  row: number[] = []
  row2: number[] = []
  bend: number[] = []
  width: number[] = []
  color: number[] = []
  bits: number[] = []
  hits: ConnectorHit[] = []

  feed(): ConnectorFeed {
    return {
      channels: {
        x: Uint32Array.from(this.x),
        x2: Uint32Array.from(this.x2),
        x2Region: Uint32Array.from(this.x2Region),
        row: Uint32Array.from(this.row),
        row2: Uint32Array.from(this.row2),
        bend: Float32Array.from(this.bend),
        width: Float32Array.from(this.width),
        color: Uint32Array.from(this.color),
        bits: Uint8Array.from(this.bits),
        count: this.x.length,
      },
      hits: this.hits,
    }
  }
}

/** How far a maps-back loop's arrowhead arms reach, 0 where a row is too thin for one. */
export function connectorArrowPx(featureHeight: number) {
  return featureHeight >= LOOP_ARROW_MIN_FEATURE_HEIGHT_PX
    ? Math.min(featureHeight, LOOP_MAX_ARROW_PX) / 2
    : 0
}

interface DisplayedRegion {
  refName: string
  reversed?: boolean
  start?: number
  end?: number
}

function within(r: DisplayedRegion, bp: number) {
  return bp >= (r.start ?? -Infinity) && bp <= (r.end ?? Infinity)
}

// Where an end places: through the region its read was fetched in where that
// holds the bp, else the first that does, since a long read fetched in one
// region can end, and so join, in the next. Where none does, the read overhangs
// its region's edge and the end stops there, as the read's own body does.
function placeEnd(
  displayedRegions: readonly DisplayedRegion[],
  fetchedIn: number,
  r: DisplayedRegion,
  bp: number,
) {
  const holding = within(r, bp)
    ? fetchedIn
    : displayedRegions.findIndex(o => o.refName === r.refName && within(o, bp))
  return holding === -1
    ? {
        region: fetchedIn,
        bp: Math.min(Math.max(bp, r.start ?? -Infinity), r.end ?? Infinity),
      }
    : { region: holding, bp }
}

/**
 * One pair as the connector mark draws it: each end placed on the region
 * holding it (`x`, `x2` and `x2Region`, the first end's region `region`), the
 * rows, the `bend` (a loop's set depth, a discordant dip, or `CONNECTOR_BOW`),
 * the stroke `width`, the palette `slot` its color comes from at `alpha`, and
 * the `CONNECTOR_*` bits. Undefined where an end's region is not displayed.
 */
export function connectorInstance(
  pair: LinkedPair,
  displayedRegions: readonly DisplayedRegion[],
  pileupHeight: number,
  rowPitch: number,
  arrows: boolean,
) {
  const { e1, e2, c } = pair
  const r1 = displayedRegions[e1.displayedRegionIndex]
  const r2 = displayedRegions[e2.displayedRegionIndex]
  if (r1 && r2) {
    const own = placeEnd(displayedRegions, e1.displayedRegionIndex, r1, c.bp1)
    const far = placeEnd(displayedRegions, e2.displayedRegionIndex, r2, c.bp2)
    const { straight, hidden, loop, dipPx } = connectorShape(
      pair,
      r1,
      r2,
      displayedRegions,
      pileupHeight,
    )
    return {
      region: own.region,
      x: own.bp,
      x2: far.bp,
      x2Region: far.region,
      row: e1.data.readYs[e1.readIdx]!,
      row2: e2.data.readYs[e2.readIdx]!,
      bend: loop ? loopDipPx(rowPitch) : (dipPx ?? CONNECTOR_BOW),
      width: straight
        ? LINKED_READ_LINE_WIDTH_PX
        : loop
          ? LOOP_STROKE_WIDTH_PX
          : CURVE_STROKE_WIDTH_PX,
      slot: linkedReadColorSlot(c.colorType),
      alpha: loop ? 1 : LINKED_READ_LINE_ALPHA,
      straight,
      loop,
      hidden,
      bits:
        (c.s1 < 0 ? CONNECTOR_MINUS_1 : 0) |
        (c.s2 < 0 ? CONNECTOR_MINUS_2 : 0) |
        (c.isSplit ? CONNECTOR_LEADING_2 : 0) |
        (straight ? CONNECTOR_STRAIGHT : 0) |
        (hidden ? CONNECTOR_DASHED : 0) |
        (loop && arrows ? CONNECTOR_ARROW : 0),
    }
  }
  return undefined
}

/**
 * One pair the straight-line pass draws (`GroupConnectors.linePairs`), in
 * `connectorInstance`'s shape: that pass draws every pair it holds as a
 * straight line, so a pair whose own shape would dip under its row is
 * straight here too.
 */
export function linePassInstance(
  pair: LinkedPair,
  displayedRegions: readonly DisplayedRegion[],
  pileupHeight: number,
  rowPitch: number,
) {
  const placed = connectorInstance(
    pair,
    displayedRegions,
    pileupHeight,
    rowPitch,
    false,
  )
  return placed && !placed.straight
    ? {
        ...placed,
        bend: CONNECTOR_BOW,
        width: LINKED_READ_LINE_WIDTH_PX,
        alpha: LINKED_READ_LINE_ALPHA,
        straight: true,
        bits: placed.bits | CONNECTOR_STRAIGHT,
      }
    : placed
}

// Clearance under the deepest apex for the stroke, which a hover thickens.
const DIP_FLOOR_PAD_PX = 2
// The share of the room under its row a dip may take. Short of all of it, so
// the rows the floor flattens keep their apexes apart, in row order, where
// taking it all piled every one of them on the floor as a stripe.
const DIP_ROOM_SHARE = 0.5

/** The deepest a dip starting at `rowCenterPx` reaches above `dipFloorPx`. */
function dipRoomPx(rowCenterPx: number, dipFloorPx: number) {
  return Math.max(
    0,
    (dipFloorPx - DIP_FLOOR_PAD_PX - rowCenterPx) * DIP_ROOM_SHARE,
  )
}

export interface ConnectorFeedInput {
  pairs: readonly LinkedPair[]
  displayedRegions: readonly DisplayedRegion[]
  featureHeight: number
  featureSpacing: number
  /** The section's laid-out pileup band, which a discordant dip is sized to. */
  pileupHeight: number
  /**
   * How far below the band's top the bottom of the display sits. A dip or
   * loop takes at most half the room between its row and there.
   */
  dipFloorPx: number
  colors: ColorPalette
  labels?: Partial<Record<SwatchCategory, string>>
}

/**
 * One section's connectors by the displayed region holding each pair's first
 * end, the far end placed through the region holding it. Everything here is
 * layout, never a screen position, so a pan or zoom rebuilds nothing: the
 * mark projects both ends through the view's region table.
 *
 * A normal connection is a straight segment, a maps-back loop dips a set depth
 * under its row and ends in an arrowhead, a hidden-segment junction is dashed,
 * and everything else dips by `discordantDipPx` (`connectorShape`), or by
 * half the room left above `dipFloorPx` where that is less.
 */
export function buildConnectorFeeds({
  pairs,
  displayedRegions,
  featureHeight,
  featureSpacing,
  pileupHeight,
  dipFloorPx,
  colors,
  labels,
}: ConnectorFeedInput): Map<number, ConnectorFeed> {
  const palette = buildArcColorPalette(colors)
  const rowPitch = featureHeight + featureSpacing
  const arrows = connectorArrowPx(featureHeight) > 0
  const byRegion = new Map<number, Lanes>()
  for (const pair of pairs) {
    const placed = connectorInstance(
      pair,
      displayedRegions,
      pileupHeight,
      rowPitch,
      arrows,
    )
    if (placed) {
      let lanes = byRegion.get(placed.region)
      if (!lanes) {
        lanes = new Lanes()
        byRegion.set(placed.region, lanes)
      }
      const opaque = normalizedRgbToABGR(...palette[placed.slot]!)
      lanes.x.push(placed.x)
      lanes.x2.push(placed.x2)
      lanes.x2Region.push(placed.x2Region)
      lanes.row.push(placed.row)
      lanes.row2.push(placed.row2)
      lanes.bend.push(
        placed.bend === CONNECTOR_BOW
          ? placed.bend
          : Math.min(
              placed.bend,
              dipRoomPx(
                Math.max(placed.row, placed.row2) * rowPitch +
                  featureHeight / 2,
                dipFloorPx,
              ),
            ),
      )
      lanes.width.push(placed.width)
      lanes.color.push(
        placed.alpha === 1
          ? opaque
          : withAbgrAlpha(opaque, Math.round(placed.alpha * 255)),
      )
      lanes.bits.push(placed.bits)
      lanes.hits.push({
        id1: readIdAt(pair.e1.data, pair.e1.readIdx)!,
        id2: readIdAt(pair.e2.data, pair.e2.readIdx)!,
        readName: readNameAt(pair.e1.data, pair.e1.readIdx),
        label: arcColorCategoryLabel(arcSlotCategory(placed.slot), labels),
        hiddenSegmentsBetween: pair.hiddenSegmentsBetween,
      })
    }
  }
  return new Map([...byRegion].map(([region, lanes]) => [region, lanes.feed()]))
}
