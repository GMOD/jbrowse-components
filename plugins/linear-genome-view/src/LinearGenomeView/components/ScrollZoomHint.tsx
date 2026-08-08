import { MUI_TOOLTIP_Z_INDEX } from '@jbrowse/core/ui/zIndexes'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import MouseIcon from '@mui/icons-material/Mouse'
import { Button, Fade, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { createPortal } from 'react-dom'

import type { LinearGenomeViewModel } from '../index.ts'

// roughly half the prompt's width and its height, used only to keep it clear of
// the window edges — being a few pixels out just shifts it, so this doesn't
// need to be measured
const HALF_WIDTH = 150
const HEIGHT = 48
// far enough below the pointer not to sit under it, close enough to read as
// belonging to the gesture
const CURSOR_GAP = 20

const useStyles = makeStyles()(theme => ({
  hint: {
    position: 'fixed',
    // clamped rather than measured: near a window edge the prompt slides along
    // it instead of hanging off it
    transform: 'translateX(-50%)',
    // over the app bar and every view chrome — a prompt that loses a z-fight is
    // the same as no prompt
    zIndex: MUI_TOOLTIP_Z_INDEX,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 0.5, 0.5, 1.5),
    whiteSpace: 'nowrap',
  },
  icon: {
    // optically aligns the glyph with the text baseline
    display: 'block',
  },
}))

/**
 * The prompt raised when a wheel over the view did nothing at all — see
 * `useScrollZoomHint` for when that is and why it's the only moment worth
 * interrupting.
 *
 * It says what would have worked *and* offers the setting, because the point is
 * to spend the user's attention once: they came here wanting to zoom, so the
 * useful reply is a way to zoom, not the name of a preference they now have to
 * go and find. `ctrl + scroll` is named rather than the platform's other
 * modifier — meta works too, but ctrl works everywhere, so it is never the
 * wrong thing to have read.
 *
 * Portalled to the body and positioned in viewport coordinates, which is not
 * fussiness: this fires most often when the user has scrolled to the bottom of
 * a view, so anything positioned inside the view is off-screen at the one
 * moment it matters — and `contain`/`transform` on the containers between here
 * and the body would capture a plain `position: fixed` anyway.
 */
const ScrollZoomHint = observer(function ScrollZoomHint({
  model,
  show,
  at,
  onDismiss,
  onHeldChange,
}: {
  model: LinearGenomeViewModel
  show: boolean
  at: { x: number; y: number }
  onDismiss: () => void
  onHeldChange: (held: boolean) => void
}) {
  const { classes } = useStyles()
  return createPortal(
    <Fade in={show} appear unmountOnExit>
      <Paper
        elevation={8}
        className={classes.hint}
        role="status"
        style={{
          left: `clamp(${HALF_WIDTH}px, ${at.x}px, calc(100vw - ${HALF_WIDTH}px))`,
          top: `clamp(0px, ${at.y + CURSOR_GAP}px, calc(100vh - ${HEIGHT}px))`,
        }}
        onMouseEnter={() => {
          onHeldChange(true)
        }}
        onMouseLeave={() => {
          onHeldChange(false)
        }}
      >
        <MouseIcon fontSize="small" className={classes.icon} />
        <Typography variant="body2">ctrl + scroll to zoom</Typography>
        <Button
          size="small"
          onClick={() => {
            model.setScrollZoom(true)
            onDismiss()
          }}
        >
          Always zoom on scroll
        </Button>
      </Paper>
    </Fade>,
    document.body,
  )
})

export default ScrollZoomHint
