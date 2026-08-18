import { clamp } from '../util/numericUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'

/**
 * How deep each edge fade is. Enough to read as a soft edge under the content
 * rather than as a rule, not so deep that it dims a whole row (the shortest row
 * a display draws is ~7px in its most compact mode).
 */
const SHADOW_HEIGHT = 16

/**
 * Sub-pixel slack before an edge counts as scrolled away from. A fit/grow mode
 * scale leaves float epsilon in `contentHeight`, and without this a track that
 * exactly fits draws a permanent bottom fade — the one thing this must never
 * do, since "nothing is hidden" is the state it exists to distinguish.
 *
 * `VerticalScrollbar` has no equivalent and so still draws a full-height thumb
 * on that same sub-pixel overflow. Deliberately not lifted there: a thumb
 * filling its track reads as "nothing to scroll", where a permanent fade reads
 * as "something is hidden" — the wrong answer rather than a redundant one.
 */
const EPSILON = 0.5

const useStyles = makeStyles()(theme => {
  // The ink flips with the theme, and has to: a black shadow is invisible on
  // the dark theme's #121212 canvas, which is the same trap the scrollbar thumb
  // hit before it became theme-aware.
  const ink = theme.palette.mode === 'dark' ? '255,255,255' : '0,0,0'
  // 0.18, down from the 0.3 this shipped at: over a dense pileup the deep end
  // of the ramp read as a band of its own and drew the eye before the features
  // did, which inverts what it is for. It only has to be findable when someone
  // asks "is that everything?", not noticeable when nobody asked.
  const from = `rgba(${ink},0.18)`
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
 * its content virtually — the same displays that mount `VerticalScrollbar`,
 * drawn from the same three numbers.
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
export default function ScrollEdgeShadow({
  scrollTop,
  viewportHeight,
  contentHeight,
  top = 0,
}: {
  scrollTop: number
  /** the visible viewport height */
  viewportHeight: number
  /** the full scrollable content height */
  contentHeight: number
  /** viewport offset from the top, for a display with a sticky band above it */
  top?: number
}) {
  const { classes, cx } = useStyles()
  const scrollableHeight = Math.max(0, contentHeight - viewportHeight)
  if (scrollableHeight <= 0) {
    return null
  }
  const clamped = clamp(scrollTop, 0, scrollableHeight)
  // never deeper than the viewport itself: the bottom edge is placed by
  // subtracting this from the viewport's floor, so an unclamped SHADOW_HEIGHT
  // on a viewport shorter than it puts the ink above the viewport's own top,
  // over whatever pinned band the display stacked there. Reachable both ways —
  // the variants displays floor availableHeight at 0 because lineZoneHeight can
  // exceed the display height on its own, and the pileup's coverage band drags
  // up to the same place.
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
}
