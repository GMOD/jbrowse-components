import React from 'react'
import { observer } from 'mobx-react'
import { IconButton, Paper } from '@mui/material'

// icons
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import ArrowDown from '@mui/icons-material/KeyboardArrowDown'

// locals
import { LinearGenomeViewModel } from '..'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  background: {
    position: 'absolute',
    right: 0,
    zIndex: 1001,
    background: theme.palette.background.paper,
  },
  focusedBackground: {
    background: theme.palette.secondary.light,
    svg: {
      fill: 'white',
    },
  },
}))

const MiniControls = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { bpPerPx, maxBpPerPx, minBpPerPx, scaleFactor, hideHeader } = model
  const session = getSession(model)
  return hideHeader ? (
    <Paper
      className={
        session.focusedViewId === model.id
          ? `${classes.background} ${classes.focusedBackground}`
          : classes.background
      }
    >
      <CascadingMenuButton menuItems={model.menuItems()}>
        <ArrowDown fontSize="small" />
      </CascadingMenuButton>
      <IconButton
        data-testid="zoom_out"
        onClick={() => model.zoom(bpPerPx * 2)}
        disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
      >
        <ZoomOut fontSize="small" />
      </IconButton>
      <IconButton
        data-testid="zoom_in"
        onClick={() => model.zoom(model.bpPerPx / 2)}
        disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
      >
        <ZoomIn fontSize="small" />
      </IconButton>
    </Paper>
  ) : null
})

export default MiniControls
