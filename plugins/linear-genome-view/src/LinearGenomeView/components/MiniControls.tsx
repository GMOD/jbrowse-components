import { useEffect, useRef, useState } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDown from '@mui/icons-material/KeyboardArrowDown'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { IconButton, Paper, alpha } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
  background: {
    position: 'absolute',
    right: 0,
    background: theme.palette.background.paper,

    // needed when sticky header is off in lgv, e.g. in breakpoint split view
    zIndex: 2,
  },
  innerPaper: {
    position: 'relative',
  },
  focusHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: alpha(theme.palette.secondary.light, 0.4),
    pointerEvents: 'none',
    animation: 'focusFadeOut 1.5s ease-out forwards',
    '@keyframes focusFadeOut': {
      '0%': {
        opacity: 1,
      },
      '100%': {
        opacity: 0.3,
      },
    },
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
      <Paper className={classes.innerPaper}>
        {isFocused ? (
          <div key={animationKey} className={classes.focusHighlight} />
        ) : null}
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
