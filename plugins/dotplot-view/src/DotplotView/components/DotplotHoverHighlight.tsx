import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'

const useStyles = makeStyles()({
  // Stacked over the canvas inside the view's overlay layer, which is where
  // this has to live: the grid, the highlight bands and the rubber band all
  // render UNDER the dots (see MouseInteractionLayer), and a hover cue drawn
  // there would be hidden by the very alignment it is pointing at.
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    pointerEvents: 'none',
  },
})

// Extra stroke width over the plot's own lineWidth: the feature's own color,
// and a knockout under it so the pair stays findable inside a dense hairball.
// The knockout is the wider of the two, so it reads as an outline.
const HIGHLIGHT_EXTRA_PX = 3
const KNOCKOUT_EXTRA_PX = 7

/**
 * The hovered alignment, restroked opaque and a few px wider over the canvas.
 *
 * The cue is opacity and width rather than a highlight hue, because every hue is
 * taken: category10 paints the chromosome color-by modes, and red/blue/black are
 * the strand and default schemes. The knockout is the theme's own background, so
 * it works in both palettes without naming a color either.
 *
 * See `DotplotDisplay.hoveredFeatureHighlight` for why the shading is here at
 * all rather than in the two renderers, as synteny's is.
 */
const DotplotHoverHighlight = observer(function DotplotHoverHighlight({
  model,
}: {
  model: DotplotViewModel
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const { hoveredHighlight, lineWidth, viewWidth, viewHeight } = model
  return hoveredHighlight ? (
    <svg className={classes.root} width={viewWidth} height={viewHeight}>
      <path
        d={hoveredHighlight.path}
        fill="none"
        stroke={theme.palette.background.default}
        strokeOpacity={0.85}
        strokeWidth={lineWidth + KNOCKOUT_EXTRA_PX}
        strokeLinecap="round"
      />
      {/* round caps, matching the capsule SDF and Canvas2D's lineCap — a
          sub-pixel alignment is a dot on this plot, and squaring it off here
          would highlight a different shape than the one drawn */}
      <path
        d={hoveredHighlight.path}
        fill="none"
        stroke={hoveredHighlight.color}
        strokeWidth={lineWidth + HIGHLIGHT_EXTRA_PX}
        strokeLinecap="round"
      />
    </svg>
  ) : null
})

export default DotplotHoverHighlight
