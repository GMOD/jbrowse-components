import { observer } from 'mobx-react'

import { clamp } from '../util/numericUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { VirtualScrollModel } from '../util/useVirtualScrollWheel.ts'

// deep enough to read as a soft edge rather than a rule
const SHADOW_HEIGHT = 10

// Slack at each edge, so a float residue in `scrollTop` doesn't mark one.
const EPSILON = 0.5

const useStyles = makeStyles()(theme => {
  // The ink flips with the theme, and has to: a black shadow is invisible on
  // the dark theme's #121212 canvas, which is the same trap the scrollbar thumb
  // hit before it became theme-aware.
  const ink = theme.palette.mode === 'dark' ? '255,255,255' : '0,0,0'
  // findable when someone asks "is that everything?", not noticeable when
  // nobody asked
  const from = `rgba(${ink},0.1)`
  // NOT the `transparent` keyword, which is transparent BLACK: interpolating to
  // it puts a grey cast through the middle of the ramp, and on the dark theme's
  // white ink that is the whole ramp.
  const to = `rgba(${ink},0)`
  return {
    edge: {
      position: 'absolute',
      left: 0,
      right: 0,
      pointerEvents: 'none',
    },
    top: { background: `linear-gradient(to bottom, ${from}, ${to})` },
    bottom: { background: `linear-gradient(to top, ${from}, ${to})` },
  }
})

/**
 * The "there is more content this way" edge shadow for a display that scrolls
 * its content virtually, mounted beside `VerticalScrollbar` by `ScrollChrome`.
 *
 * It answers a question the scrollbar technically also answers and in practice
 * does not: **is this track showing me all of its features?** A 6px thumb on a
 * dense track is missed even by someone looking for it — GMOD/jbrowse-components#5589,
 * and the figure review that read `k562_bcr_abl_split` past a scrolled-away
 * pileup twice.
 *
 * Two properties are what keep it from being noise, and both are worth keeping
 * if this is ever restyled:
 *
 * - **It costs nothing when nothing is hidden.** No content past an edge, no
 *   fade at that edge; a track that fits draws neither. So it is a readout of
 *   state, not a decoration — which a recoloured bottom border could not be
 *   (and which would also need `showTrackOutlines`, an option the user can turn
 *   off, to have a border to recolour).
 * - **It says which way.** Scrolled to the bottom, the bottom fade goes and the
 *   top one appears, so "am I at the end" is answerable without scrolling.
 *
 * Shadowing with ink rather than dissolving the content into the track's own
 * background is a decision, not the obvious default, and the reason is the
 * sparse case: a dissolve over empty background is background-over-background,
 * so a track whose last visible strip happens to be blank — with rows below it —
 * is marked by nothing at all. Ink marks the edge whatever is under it. The cost
 * is that the dark theme's white ink brightens the last row of a dense pileup
 * rather than darkening it; both were drawn and compared, and covering the
 * sparse case won.
 *
 * The actionable half lives in the bottom-right corner (`TrackHeightIndicator`
 * — autogrow/fit, and the truncation warning for features that were dropped
 * rather than merely scrolled away). This says *that*; that says *what to do*.
 */
const ScrollEdgeShadow = observer(function ScrollEdgeShadow({
  model,
  top = 0,
}: {
  model: VirtualScrollModel
  /** viewport offset from the top, for a display with a sticky band above it */
  top?: number
}) {
  const { classes, cx } = useStyles()
  const { scrollableHeight, scrollViewportHeight: viewportHeight } = model
  if (scrollableHeight <= 0) {
    return null
  }
  const clamped = clamp(model.scrollTop, 0, scrollableHeight)
  // never deeper than the viewport, or the bottom edge inks the band above it
  const height = Math.min(SHADOW_HEIGHT, viewportHeight)
  return (
    <>
      {clamped > EPSILON ? (
        <div
          data-testid="scroll-edge-shadow-top"
          className={cx(classes.edge, classes.top)}
          style={{ top, height }}
        />
      ) : null}
      {clamped < scrollableHeight - EPSILON ? (
        <div
          data-testid="scroll-edge-shadow-bottom"
          className={cx(classes.edge, classes.bottom)}
          style={{ top: top + viewportHeight - height, height }}
        />
      ) : null}
    </>
  )
})

export default ScrollEdgeShadow
