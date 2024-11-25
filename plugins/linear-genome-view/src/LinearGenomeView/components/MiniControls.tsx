import React from 'react'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'

// icons
import ArrowDown from '@mui/icons-material/KeyboardArrowDown'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton, Paper, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
  background: {
    position: 'absolute',
    right: 0,
    zIndex: 1001,
    background: theme.palette.background.paper,
  },
  focusedBackground: {
    background: alpha(theme.palette.secondary.light, 0.2),
  },
}))

const MiniControls = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { id, bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor, hideHeader } = model
  const { focusedViewId } = getSession(model)
  return hideHeader ? (
    <Paper className={classes.background}>
      <Paper
        className={focusedViewId === id ? classes.focusedBackground : undefined}
      >
        <CascadingMenuButton menuItems={model.menuItems()}>
          <ArrowDown fontSize="small" />
        </CascadingMenuButton>
        <IconButton
          data-testid="zoom_out"
          onClick={() => {
            model.zoom(bpPerPx * 2)
          }}
          disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
        >
          <ZoomOut fontSize="small" />
        </IconButton>
        <IconButton
          data-testid="zoom_in"
          onClick={() => {
            model.zoom(bpPerPx / 2)
          }}
          disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
        >
          <ZoomIn fontSize="small" />
        </IconButton>
      </Paper>
    </Paper>
  ) : null
})

export default MiniControls
