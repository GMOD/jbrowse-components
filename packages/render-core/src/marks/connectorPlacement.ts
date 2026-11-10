import {
  CONNECTOR_ARROW,
  CONNECTOR_LEADING_2,
  CONNECTOR_MAX_HANDLE_PX,
  CONNECTOR_MINUS_1,
  CONNECTOR_MINUS_2,
  CONNECTOR_STRAIGHT,
} from '../shaders/connectorMark.consts.generated.ts'
import {
  connectorArrowFits,
  connectorBudgetPx,
  connectorHandlePx,
  connectorLiftPx,
  connectorStrokePx,
  connectorTangent,
} from '../shaders/connectorMark.js.generated.ts'
import { linkedRegion, regionPx } from './linkRegion.ts'

import type { ConnectorChannels, ConnectorParams } from './connectorMark.ts'

/** One placed connector: its cubic's four points and how it is stroked. */
export interface ConnectorPlacement {
  x0: number
  y0: number
  x1: number
  y1: number
  x2: number
  y2: number
  x3: number
  y3: number
  strokePx: number
  arrow: boolean
  /** The arrowhead arms' screen-x reach back from the tip. */
  back: number
}

export function newPlaced(): ConnectorPlacement {
  return {
    x0: 0,
    y0: 0,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    x3: 0,
    y3: 0,
    strokePx: 0,
    arrow: false,
    back: 0,
  }
}

const strandOf = (bits: number, bit: number) => ((bits & bit) !== 0 ? -1 : 1)

// Places instance `i` into `p` as the shader does, or answers false where its
// far end lies on no displayed region the table holds.
export function placeConnector(
  c: ConnectorChannels,
  params: ConnectorParams,
  own: number,
  i: number,
  p: ConnectorPlacement,
  dpr: number,
) {
  const { regions } = params
  const far = c.x2Region[i]!
  const ownRegion = regions[own]
  const farRegion = linkedRegion(regions, far)
  if (!ownRegion || !farRegion) {
    return false
  }
  const bits = c.bits[i]!
  p.x0 = regionPx(regions, own, c.x[i]!)
  p.y0 = params.rowOffsetPx + c.row[i]! * params.rowPitchPx
  p.x3 = regionPx(regions, far, c.x2[i]!)
  p.y3 = params.rowOffsetPx + c.row2[i]! * params.rowPitchPx
  p.strokePx = connectorStrokePx(c.width[i]!, dpr)
  const reversed2 = farRegion.signedPxPerBp < 0
  const strand2 = strandOf(bits, CONNECTOR_MINUS_2)
  p.arrow =
    (bits & CONNECTOR_ARROW) !== 0 &&
    connectorArrowFits(p.x3 - p.x0, params.arrowPx) !== 0
  p.back = (reversed2 ? -strand2 : strand2) * -params.arrowPx
  if ((bits & CONNECTOR_STRAIGHT) !== 0) {
    p.x1 = p.x0
    p.y1 = p.y0
    p.x2 = p.x3
    p.y2 = p.y3
    return true
  }
  const dx = p.x3 - p.x0
  const dy = p.y3 - p.y0
  const budget = connectorBudgetPx(dx, dy)
  const handle = connectorHandlePx(
    budget,
    params.maxHandlePx ?? CONNECTOR_MAX_HANDLE_PX,
  )
  const lift = connectorLiftPx(budget, dx, dy, c.bend[i]!)
  const t1 = connectorTangent(
    strandOf(bits, CONNECTOR_MINUS_1),
    0,
    ownRegion.signedPxPerBp < 0 ? 1 : 0,
  )
  const t2 = connectorTangent(
    strand2,
    (bits & CONNECTOR_LEADING_2) !== 0 ? 1 : 0,
    reversed2 ? 1 : 0,
  )
  p.x1 = p.x0 + handle * t1
  p.y1 = p.y0 - lift
  p.x2 = p.x3 + handle * t2
  p.y2 = p.y3 - lift
  return true
}

/**
 * Instance `i`'s cubic and arrowhead as the mark places them, in px, for a
 * host drawing the same curve at its own scale; undefined where it places
 * nowhere.
 */
export function connectorPlacement(
  c: ConnectorChannels,
  params: ConnectorParams,
  own: number,
  i: number,
  dpr = 1,
) {
  const p = newPlaced()
  return placeConnector(c, params, own, i, p, dpr) ? p : undefined
}
