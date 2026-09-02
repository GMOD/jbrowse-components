import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { LinearAlignmentsDisplayModel } from './useAlignmentsBase.ts'

const useStyles = makeStyles()(theme => ({
  svg: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    // The canvas underneath answers the hover. An overlay that took events
    // would let the mark destroy the hover that produced it, pixel by pixel.
    pointerEvents: 'none',
  },
  path: {
    fill: 'none',
    stroke: theme.palette.text.primary,
    // Under the arc's own color rather than replacing it, so the category color
    // the tooltip names is still the color on screen.
    opacity: 0.55,
  },
}))

// Which read-connection arc the tooltip is talking about.
//
// The tooltip can say "heaviest of several here", which invites exactly this
// question — and even over a lone arc, naming a junction with nothing marking it
// is a claim the reader has to take on trust. Sashimi and the linked-read bezier
// overlay already thicken their hovered path; they are SVG with per-path
// handlers, so they get it for free. Arcs are canvas, so this is the equivalent.
//
// An overlay rather than a canvas pass because the canvas is repaint-tier: the
// hovered arc changes on nearly every mousemove, and on the Canvas2D fallback a
// repaint re-rasterizes the whole pileup. Same reason `HighlightOverlay` is a
// div rather than a read-fill pass.
const ArcHoverOverlay = observer(function ArcHoverOverlay({
  model,
}: {
  model: LinearAlignmentsDisplayModel
}) {
  const { classes } = useStyles()
  const highlight = model.hoveredArcHighlight
  if (!highlight) {
    return null
  }
  const { d, clip, lineWidth, dash } = highlight
  const clipId = `arc-hover-clip-${model.id}`
  return (
    <svg className={classes.svg} height={model.height}>
      <defs>
        <clipPath id={clipId}>
          {/* The block's scissor, both axes — the rect the renderers cut the
              arc pass to. Was `x=0 width="100%"`, which clipped the half of a
              far arc that leaves through the band ceiling and let through the
              half that leaves through the block's side. */}
          <rect {...clip} />
        </clipPath>
      </defs>
      <path
        className={classes.path}
        d={d}
        strokeWidth={lineWidth + 3}
        strokeDasharray={dash}
        clipPath={`url(#${clipId})`}
      />
    </svg>
  )
})

export default ArcHoverOverlay
