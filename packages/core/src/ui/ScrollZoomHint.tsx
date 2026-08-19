import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { Button, Fade, Paper, Typography } from '@mui/material'
import { createPortal } from 'react-dom'

import { makeStyles } from '../util/tss-react/index.ts'
import { SCROLL_ZOOM_HINT_ATTR } from '../util/usePanZoom.ts'
import { MUI_TOOLTIP_Z_INDEX } from './zIndexes.ts'

// roughly half the prompt's width and its height, used only to keep it clear of
// the window edges — being a few pixels out just shifts it, so this doesn't
// need to be measured
const HALF_WIDTH = 150
const HEIGHT = 48
/**
 * The modifier the prompt names. The wheel handler takes either one on either
 * platform, so this is about which one to *say*.
 *
 * ⌘ on a Mac, and not only because it is the key a Mac user reaches for:
 * macOS's "zoom using scroll wheel" accessibility setting takes ctrl+wheel
 * before the page ever sees it, and zooms the whole screen. For anyone with
 * that on — which is the same population reaching for a zoom they can't find —
 * advice naming ctrl is advice that visibly does the wrong thing.
 *
 * Read once at module scope: a machine does not change platform. The
 * `navigator.platform` deprecation is irrelevant here — it is still populated
 * everywhere, and `userAgent` covers a host that ever empties it.
 */
const ZOOM_MODIFIER = /mac/i.test(navigator.platform || navigator.userAgent)
  ? '⌘'
  : 'ctrl'

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
 * go and find. The modifier it names is the one that platform's users reach for
 * — see ZOOM_MODIFIER.
 *
 * Portalled to the body and positioned in viewport coordinates, which is not
 * fussiness: this fires most often when the user has scrolled to the bottom of
 * a view, so anything positioned inside the view is off-screen at the one
 * moment it matters — and `contain`/`transform` on the containers between here
 * and the body would capture a plain `position: fixed` anyway.
 *
 * Takes an `onEnable` rather than a view: nothing here reads model state, and
 * scroll-to-zoom is a session preference every wheel-zoom view shares, so the
 * card is the same card whichever one raised it.
 */
function ScrollZoomHint({
  show,
  at,
  onEnable,
  onHeldChange,
}: {
  show: boolean
  at: { x: number; y: number }
  onEnable: () => void
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
        // the marker that tells the dismiss-on-a-press-elsewhere listener that
        // a press landing here is aimed at the button below, not at the app
        {...{ [SCROLL_ZOOM_HINT_ATTR]: '' }}
        // `mousemove`, not `mouseenter`: the prompt is drawn just below the
        // cursor and near the bottom of the window it is clamped up *onto* it,
        // so it routinely appears under a pointer that never moved. An enter
        // there latches the hold on a user who isn't reaching for anything, and
        // the matching `mouseleave` only arrives if they happen to move the
        // mouse again — which is exactly how it gets stuck open. Requiring a
        // move means the hold is only taken by a pointer that came here.
        onMouseMove={() => {
          onHeldChange(true)
        }}
        onMouseLeave={() => {
          onHeldChange(false)
        }}
      >
        {/* the glyph on the header control this offers, so the card
        points at where the setting lives once it has faded */}
        <ZoomInMapIcon fontSize="small" className={classes.icon} />
        <Typography variant="body2">
          {ZOOM_MODIFIER} + scroll to zoom
        </Typography>
        <Button size="small" onClick={onEnable}>
          Always zoom on scroll
        </Button>
      </Paper>
    </Fade>,
    document.body,
  )
}

export default ScrollZoomHint
