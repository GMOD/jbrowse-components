import {
  connectorBudgetPx,
  connectorHandlePx,
  connectorLiftPx,
  connectorTangent,
} from '@jbrowse/render-core/shaders/connectorMark'
import {
  CONNECTOR_APEX_RATIO,
  CONNECTOR_BOW,
  CONNECTOR_MAX_HANDLE_PX,
  CONNECTOR_MAX_REACH_PX,
} from '@jbrowse/render-core/shaders/connectorMarkConsts'

/**
 * A symmetric cubic's extreme sits 3/4 of the way from its baseline to its
 * controls; the sashimi labels solve the same equation in the other direction.
 */
export const CUBIC_APEX_RATIO = CONNECTOR_APEX_RATIO

/**
 * How far a curve can stray outside the band between its two endpoints, which
 * a culler pads its viewport test by.
 */
export const BEZIER_CONNECTOR_MAX_REACH_PX = CONNECTOR_MAX_REACH_PX

/**
 * One horizontal-tangent connector curve as an SVG path: the read and
 * breakpoint connector BreakpointSplitView's AlignmentConnections draws, and
 * the alignments display draws as render-core's `connector` mark. The
 * geometry is that shader's own, through its JS twin, so the two views cannot
 * drift in which way a connection leaves its read.
 *
 * A discordant connection dips below its ends instead of bowing up over them,
 * so the two classes read apart at a glance. How deep is the caller's call:
 * only it knows the band the ink has to survive in, and `discordantDipPx`
 * (@jbrowse/sv-core) is the law the two views share.
 */
export function bezierConnectorPath({
  x1,
  y1,
  x2,
  y2,
  s1,
  s2,
  // The second endpoint is a split junction's 5' leading edge (its handle flips
  // to fold the curve into the next segment); false for a paired mate's 3' edge.
  leadingEnd2 = false,
  reversed1 = false,
  reversed2 = false,
  maxHandlePx = CONNECTOR_MAX_HANDLE_PX,
  // Depth, in px, of the APEX of the dip a discordant connection draws instead
  // of the bow a concordant one gets. Leave it out to bow up.
  dipPx,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  s1: number
  s2: number
  leadingEnd2?: boolean
  reversed1?: boolean
  reversed2?: boolean
  maxHandlePx?: number
  dipPx?: number
}) {
  const dy = y2 - y1
  const budget = connectorBudgetPx(x2 - x1, dy)
  const handle = connectorHandlePx(budget, maxHandlePx)
  const lift = connectorLiftPx(budget, dy, dipPx ?? CONNECTOR_BOW)
  const c1x = x1 + handle * connectorTangent(s1, 0, reversed1 ? 1 : 0)
  const c2x =
    x2 + handle * connectorTangent(s2, leadingEnd2 ? 1 : 0, reversed2 ? 1 : 0)
  return `M ${x1} ${y1} C ${c1x} ${y1 - lift} ${c2x} ${y2 - lift} ${x2} ${y2}`
}
