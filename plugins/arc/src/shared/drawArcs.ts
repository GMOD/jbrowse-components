import { arcLabelBaselineY, arcOnScreen } from './arcLayout.ts'
import { arcMidX, arcStroke } from './arcShape.ts'

import type { ArcTick, LaidOutArc } from './arcLayout.ts'
import type { Feature } from '@jbrowse/core/util'

// Exported because the export path paints the same labels as `<text>`: one
// definition, so screen and figure cannot drift apart on a color or a halo.
export const SELECTED_COLOR = 'red'
export const LABEL_COLOR = 'black'
export const LABEL_HALO_COLOR = 'white'
// The halo width as a fraction of the font size — SVG's `stroke-width: 0.6em`.
export const LABEL_HALO_EM = 0.6

export interface ArcDrawOpts {
  /** The arc the cursor is on, which takes `hoverColor` instead of its own. */
  hovered?: Feature
  hoverColor: string
  /** Anything whose ink lands outside `[0, viewWidth]` is not painted. */
  viewWidth: number
  /**
   * The label font, as a CSS `font` shorthand. The `<text>` elements this
   * replaces inherited the app's font through the cascade; a canvas inherits
   * nothing, so the caller resolves it from the theme.
   */
  font: string
}

export function drawArcs(
  ctx: CanvasRenderingContext2D,
  arcs: readonly LaidOutArc[],
  opts: ArcDrawOpts,
) {
  const { hovered, hoverColor, viewWidth } = opts
  const visible = arcs.filter(arc => arcOnScreen(arc, viewWidth))

  for (const arc of visible) {
    ctx.strokeStyle = strokeFor(arc, hovered, hoverColor)
    ctx.lineWidth = arc.strokeWidth
    arcStroke(ctx, arc.shape)
    strokeTicks(ctx, arc.ticks)
  }

  // Every curve, THEN every label. Interleaved, a later arc's stroke crosses an
  // earlier arc's label; as `<g>`s in one `<svg>` the DOM order gave that free.
  drawLabels(ctx, visible, opts)
}

// Both ticks in one path, at the stroke the caller set for the curve.
function strokeTicks(
  ctx: CanvasRenderingContext2D,
  ticks: readonly ArcTick[] | undefined,
) {
  if (!ticks?.length) {
    return
  }
  ctx.beginPath()
  for (const t of ticks) {
    ctx.moveTo(t.x1, t.y)
    ctx.lineTo(t.x2, t.y)
  }
  ctx.stroke()
}

/** A selected arc is red, and stays red under the cursor. */
function strokeFor(
  arc: LaidOutArc,
  hovered: Feature | undefined,
  hover: string,
) {
  if (arc.selected) {
    return SELECTED_COLOR
  }
  return arc.feature === hovered ? hover : arc.color
}

function drawLabels(
  ctx: CanvasRenderingContext2D,
  arcs: readonly LaidOutArc[],
  { font }: ArcDrawOpts,
) {
  const labelled = arcs.filter(arc => arc.label)
  if (labelled.length === 0) {
    return
  }
  ctx.font = font
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.lineJoin = 'round'
  ctx.lineWidth = LABEL_HALO_EM * fontSizePx(font)
  ctx.strokeStyle = LABEL_HALO_COLOR
  for (const arc of labelled) {
    const x = arcMidX(arc.shape)
    const y = arcLabelBaselineY(arc)
    ctx.strokeText(arc.label!, x, y)
    ctx.fillStyle = arc.selected ? SELECTED_COLOR : LABEL_COLOR
    ctx.fillText(arc.label!, x, y)
  }
}

// The px size out of a CSS `font` shorthand, so the halo scales the way `0.6em`
// did. Falls back rather than throwing: this only sizes a halo.
function fontSizePx(font: string) {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12)
}
