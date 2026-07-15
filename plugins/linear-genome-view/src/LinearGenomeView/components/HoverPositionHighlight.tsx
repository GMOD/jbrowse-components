import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model.ts'

// A genomic interval a connected widget is hovering, drawn as a crosshair over
// the LGV. start/end are 0-based/BED; assemblyName lets the ref be canonicalized
// when the source uses a non-canonical name.
export interface HoverHighlightPosition {
  refName: string
  start: number
  end: number
  assemblyName?: string
}

const useStyles = makeStyles()(theme => ({
  highlight: {
    height: '100%',
    position: 'absolute',
    background: alpha(theme.palette.primary.main, 0.4),
    borderLeft: `2px solid ${theme.palette.primary.main}`,
    borderRight: `2px solid ${theme.palette.primary.main}`,
    pointerEvents: 'none',
    zIndex: 10,
  },
}))

// Renders one crosshair box on the LGV for a hovered genomic interval, or
// nothing if the interval is off-screen. Shared by the widgets that publish a
// hover position (e.g. the feature-detail sequence panel and the MAF sequence
// widget).
const HoverPositionHighlight = observer(function HoverPositionHighlight({
  model,
  position,
}: {
  model: LinearGenomeViewModel
  position: HoverHighlightPosition
}) {
  const { classes } = useStyles()
  const coords = model.getHighlightCoords(position)
  return coords ? (
    <div
      className={classes.highlight}
      style={{ left: coords.left, width: coords.width }}
    />
  ) : null
})

export default HoverPositionHighlight
