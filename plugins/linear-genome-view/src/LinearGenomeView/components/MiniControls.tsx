import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { alpha } from '@jbrowse/core/ui/palette'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import ZoomButton from './ZoomButton.tsx'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  background: {
    position: 'absolute',
    right: 0,
    // needed when sticky header is off in lgv, e.g. in breakpoint split view
    zIndex: 2,
  },
  focusedBackground: {
    backgroundColor: alpha(theme.palette.secondary.light, 0.2),
  },
}))

const MiniControls = observer(function MiniControls({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { id, scalebarOnly } = model
  const { focusedViewId } = getSession(model)
  // A ruler-only row is shorter than these controls, so they rise from the
  // ruler's bottom edge rather than hang from its top: a nested row always has
  // chrome above it, while the last row of a stack has only the view's frame
  // below.
  return (
    <Paper
      data-testid="lgv-mini-controls"
      className={classes.background}
      style={
        scalebarOnly
          ? { top: model.scalebarHeight, transform: 'translateY(-100%)' }
          : undefined
      }
    >
      <Paper
        className={focusedViewId === id ? classes.focusedBackground : undefined}
      >
        <CascadingMenuButton
          tooltip="View menu"
          menuItems={() => model.menuItems()}
        >
          <MoreVertIcon fontSize="small" />
        </CascadingMenuButton>
        {/* the header's own zoom controls are gone whenever this renders (its
        only mount is the `hideHeader` branch of LinearGenomeViewContainer), so
        these are unconditional rather than re-testing hideHeader */}
        <ZoomButton model={model} direction="out" small />
        <ZoomButton model={model} direction="in" small />
      </Paper>
    </Paper>
  )
})

export default MiniControls
