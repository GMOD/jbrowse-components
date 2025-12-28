import { useEffect, useRef, useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { cx, makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDown from '@mui/icons-material/KeyboardArrowDown'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton, Paper, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
  '@keyframes focusFade': {
    '0%': {
      background: alpha(theme.palette.secondary.light, 0.4),
    },
    '100%': {
      background: theme.palette.background.paper,
    },
  },
  background: {
    position: 'absolute',
    right: 0,
    background: theme.palette.background.paper,

    // needed when sticky header is off in lgv, e.g. in breakpoint split view
    zIndex: 2,
  },
  focused: {
    animation: '$focusFade 3s ease-out forwards',
  },
}))

const MiniControls = observer(function MiniControls({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { id, bpPerPx, maxBpPerPx, minBpPerPx, hideHeader } = model
  const session = getSession(model)
  const { focusedViewId } = session
  const showShortcuts =
    'showMenuShortcuts' in session ? session.showMenuShortcuts : true
  const isFocused = focusedViewId === id
  const prevFocused = useRef(isFocused)
  const [animationKey, setAnimationKey] = useState(0)

  useEffect(() => {
    if (isFocused && !prevFocused.current) {
      setAnimationKey(k => k + 1)
    }
    prevFocused.current = isFocused
  }, [isFocused])

  return hideHeader ? (
    <Paper className={classes.background}>
      <Paper
        key={animationKey}
        className={cx(isFocused && classes.focused)}
      >
        <CascadingMenuButton
          menuItems={model.menuItems()}
          showShortcuts={showShortcuts}
        >
          <ArrowDown fontSize="small" />
        </CascadingMenuButton>
        <IconButton
          data-testid="zoom_out"
          onClick={() => {
            model.zoom(bpPerPx * 2)
          }}
          disabled={bpPerPx >= maxBpPerPx - 0.0001}
        >
          <ZoomOut fontSize="small" />
        </IconButton>
        <IconButton
          data-testid="zoom_in"
          onClick={() => {
            model.zoom(bpPerPx / 2)
          }}
          disabled={bpPerPx <= minBpPerPx + 0.0001}
        >
          <ZoomIn fontSize="small" />
        </IconButton>
      </Paper>
    </Paper>
  ) : null
})

export default MiniControls
