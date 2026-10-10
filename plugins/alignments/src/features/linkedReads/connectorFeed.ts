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
} from '@jbrowse/render-core/marks'

import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import {
  LINKED_READ_LINE_ALPHA,
  LINKED_READ_LINE_WIDTH_PX,
} from '../../shaders/slang/linkedReadLine.consts.generated.ts'
import { connectionLabel, connectorPaletteSlot } from './compute.ts'
import {
  CURVE_STROKE_WIDTH_PX,
  LOOP_ARROW_MIN_FEATURE_HEIGHT_PX,
  LOOP_MAX_ARROW_PX,
  LOOP_MAX_DIP_PX,
  LOOP_MIN_DIP_PX,
  LOOP_STROKE_WIDTH_PX,
  connectorShape,
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

const LINE_ALPHA_BYTE = Math.round(LINKED_READ_LINE_ALPHA * 255)

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

function holds(r: DisplayedRegion | undefined, refName: string, bp: number) {
  return (
    r !== undefined &&
    r.refName === refName &&
    bp >= (r.start ?? -Infinity) &&
    bp <= (r.end ?? Infinity)
  )
}

// The displayed region an end places through: the one its read was fetched in
// where that holds the bp, else the first that does. A long read fetched in one
// region can end, and so join, in the next.
function placingRegion(
  displayedRegions: readonly DisplayedRegion[],
  fetchedIn: number,
  refName: string,
  bp: number,
) {
  if (holds(displayedRegions[fetchedIn], refName, bp)) {
    return fetchedIn
  }
  const i = displayedRegions.findIndex(r => holds(r, refName, bp))
  return i === -1 ? undefined : i
}

export interface ConnectorFeedInput {
  pairs: readonly LinkedPair[]
  displayedRegions: readonly DisplayedRegion[]
  featureHeight: number
  featureSpacing: number
  /** The section's laid-out pileup band, which a discordant dip is sized to. */
  pileupHeight: number
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
 * and everything else dips by `discordantDipPx` (`connectorShape`).
 */
export function buildConnectorFeeds({
  pairs,
  displayedRegions,
  featureHeight,
  featureSpacing,
  pileupHeight,
  colors,
  labels,
}: ConnectorFeedInput): Map<number, ConnectorFeed> {
  const palette = buildLinkedReadColorPalette(colors)
  const rowH = featureHeight + featureSpacing
  const loopDipPx = Math.min(
    LOOP_MAX_DIP_PX,
    Math.max(LOOP_MIN_DIP_PX, 4 * rowH),
  )
  const arrows = connectorArrowPx(featureHeight) > 0
  const byRegion = new Map<number, Lanes>()
  for (const pair of pairs) {
    const { e1, e2, c, hiddenSegmentsBetween } = pair
    const r1 = displayedRegions[e1.displayedRegionIndex]
    const r2 = displayedRegions[e2.displayedRegionIndex]
    const own =
      r1 &&
      placingRegion(
        displayedRegions,
        e1.displayedRegionIndex,
        r1.refName,
        c.bp1,
      )
    const far =
      r2 &&
      placingRegion(
        displayedRegions,
        e2.displayedRegionIndex,
        r2.refName,
        c.bp2,
      )
    if (!r1 || !r2 || own === undefined || far === undefined) {
      continue
    }
    const { straight, hidden, loop, dipPx } = connectorShape(
      pair,
      r1,
      r2,
      displayedRegions,
      pileupHeight,
    )
    let lanes = byRegion.get(own)
    if (!lanes) {
      lanes = new Lanes()
      byRegion.set(own, lanes)
    }
    const rgb = palette[linkedReadColorSlot(connectorPaletteSlot(c.colorType))]!
    lanes.x.push(c.bp1)
    lanes.x2.push(c.bp2)
    lanes.x2Region.push(far)
    lanes.row.push(e1.data.readYs[e1.readIdx]!)
    lanes.row2.push(e2.data.readYs[e2.readIdx]!)
    lanes.bend.push(loop ? loopDipPx : (dipPx ?? CONNECTOR_BOW))
    lanes.width.push(
      straight
        ? LINKED_READ_LINE_WIDTH_PX
        : loop
          ? LOOP_STROKE_WIDTH_PX
          : CURVE_STROKE_WIDTH_PX,
    )
    const opaque = normalizedRgbToABGR(...rgb)
    lanes.color.push(loop ? opaque : withAbgrAlpha(opaque, LINE_ALPHA_BYTE))
    lanes.bits.push(
      (c.s1 < 0 ? CONNECTOR_MINUS_1 : 0) |
        (c.s2 < 0 ? CONNECTOR_MINUS_2 : 0) |
        (c.isSplit ? CONNECTOR_LEADING_2 : 0) |
        (straight ? CONNECTOR_STRAIGHT : 0) |
        (hidden ? CONNECTOR_DASHED : 0) |
        (loop && arrows ? CONNECTOR_ARROW : 0),
    )
    lanes.hits.push({
      id1: readIdAt(e1.data, e1.readIdx)!,
      id2: readIdAt(e2.data, e2.readIdx)!,
      readName: readNameAt(e1.data, e1.readIdx),
      label: connectionLabel(c.colorType, labels),
      hiddenSegmentsBetween,
    })
  }
  return new Map([...byRegion].map(([region, lanes]) => [region, lanes.feed()]))
}
