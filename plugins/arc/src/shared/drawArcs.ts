import { arcLabelBaselineY, arcOnScreen } from './arcLayout.ts'
import { arcMidX, arcStroke } from './arcShape.ts'

import type { ArcTick, LaidOutArc } from './arcLayout.ts'
import type { Feature } from '@jbrowse/core/util'

// The on-screen painter. One canvas per display, whatever the arc count — which
// is the whole change: as `<path>` elements each arc booked its own MobX
// reaction, rebuilt its own `d` and had ~3 SVG attributes patched into the DOM
// every frame of a zoom or a pan.
//
// The SVG EXPORT still emits one `<path>` per arc (`ArcsSvg`), off this same
// `LaidOutArc` list. That path runs once per export rather than once per frame,
// and a figure wants vector.

/** A selected arc is red, and stays red under the cursor. */
const SELECTED_COLOR = 'red'
const LABEL_COLOR = 'black'
const LABEL_HALO_COLOR = 'white'
// The halo's width as a fraction of the font size — SVG's `stroke-width: 0.6em`,
// which is what the two stacked `<text>` elements spent it on.
const LABEL_HALO_EM = 0.6

export interface ArcDrawOpts {
  /** The arc the cursor is on, which takes `hoverColor` instead of its own. */
  hovered?: Feature
  hoverColor: string
  /** Anything whose ink lands outside `[0, viewWidth]` is not painted. */
  viewWidth: number
  /**
   * The label font, as a CSS `font` shorthand. Resolved from the theme by the
   * caller: the `<text>` elements this replaces inherited the app's font through
   * the cascade, and a canvas inherits nothing.
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

  // Every curve, THEN every label: the labels are opaque text with a halo, and
  // interleaved they were painted over by whatever arc came after them. As
  // stacked `<text>` elements the DOM order gave that for free, since the whole
  // list was one `<g>` per arc in one `<svg>` — and it is exactly the ordering
  // the alignments band's flat connectors and endpoint squares had to be split
  // into two passes for.
  drawLabels(ctx, visible, opts)
}

// Both of an arc's mate-direction ticks in one path, at the stroke the caller
// already set for its curve — they are the same ink, and one `stroke()` for the
// pair is one rasterizer pass instead of two.
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

// The px size out of a CSS `font` shorthand, so the halo scales with the label
// the way `0.6em` did. Falls back rather than throwing: this only sizes a halo,
// and a font string with no px size still has to draw something.
function fontSizePx(font: string) {
  return Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 12)
}
