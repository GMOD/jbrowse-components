import { colord } from '../util/colord.ts'
import { clamp } from '../util/numericUtils.ts'
import { makeStyles } from '../util/tss-react/index.ts'

/**
 * How tall each edge fade is. Deep enough that content dissolving into it reads
 * as a fade rather than as a crop, shallow enough that it never swallows a whole
 * row (the shortest row a display draws is ~7px in its most compact mode).
 */
const SHADOW_HEIGHT = 16

/**
 * Sub-pixel slack before an edge counts as scrolled away from. A fit/grow mode
 * scale leaves float epsilon in `contentHeight`, and without this a track that
 * exactly fits draws a permanent bottom fade — the one thing this must never
 * do, since "nothing is hidden" is the state it exists to distinguish.
 */
const EPSILON = 0.5

const useStyles = makeStyles()(theme => {
  // Fades content toward the track's OWN background, rather than shadowing it
  // with ink. That is what makes one rule work in both themes: a black shadow
  // is invisible on the dark theme's #121212 canvas, and the white shadow that
  // replaces it brightens the last row of a dense pileup, which reads as a
  // highlight rather than as an edge. Dissolving is the same statement in both
  // — the content runs out of room — and it is *self-masking*: over empty
  // background it is background-over-background, so a sparse track is marked
  // only where something is actually being cut.
  const bg = colord(theme.palette.background.paper)
  const solid = bg.alpha(0.95).toRgbString()
  // NOT the `transparent` keyword: that is transparent BLACK, and interpolating
  // to it puts a grey cast through the middle of the ramp on a light theme.
  const clear = bg.alpha(0).toRgbString()
  // The boundary itself, for the case the dissolve cannot speak to: a strip of
  // blank background at the edge with rows below it dissolves nothing and would
  // otherwise say nothing. Dashed, in `text.disabled` — the language
  // PileupTruncationRule already uses for "the content stops here".
  const rule = `1px dashed ${theme.palette.text.disabled}`
  return {
    edge: {
      position: 'absolute',
      left: 0,
      height: SHADOW_HEIGHT,
      boxSizing: 'border-box',
      pointerEvents: 'none',
    },
    top: {
      background: `linear-gradient(to bottom, ${solid}, ${clear})`,
      borderTop: rule,
    },
    bottom: {
      background: `linear-gradient(to top, ${solid}, ${clear})`,
      borderBottom: rule,
    },
  }
})

/**
 * The "there is more content this way" edge fade for a display that scrolls its
 * content virtually — the same displays that mount `VerticalScrollbar`, drawn
 * from the same three numbers.
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
 * The actionable half lives in the bottom-right corner (`TrackHeightIndicator`
 * — autogrow/fit, and the truncation warning for features that were dropped
 * rather than merely scrolled away). This says *that*; that says *what to do*.
 */
export default function ScrollEdgeShadow({
  scrollTop,
  viewportHeight,
  contentHeight,
  top = 0,
  right = 0,
}: {
  scrollTop: number
  /** the visible viewport height */
  viewportHeight: number
  /** the full scrollable content height */
  contentHeight: number
  /** viewport offset from the top, for a display with a sticky band above it */
  top?: number
  /**
   * Right inset, for a display whose viewport does not reach its own right
   * edge. Not for clearing the scrollbar: the fade deliberately runs under it,
   * so the two read as one edge instead of stopping 12px short of the corner.
   */
  right?: number
}) {
  const { classes, cx } = useStyles()
  const scrollableHeight = Math.max(0, contentHeight - viewportHeight)
  if (scrollableHeight <= 0) {
    return null
  }
  const clamped = clamp(scrollTop, 0, scrollableHeight)
  return (
    <>
      {clamped > EPSILON ? (
        <div
          data-testid="scroll-edge-shadow-top"
          className={cx(classes.edge, classes.top)}
          style={{ top, right }}
        />
      ) : null}
      {clamped < scrollableHeight - EPSILON ? (
        <div
          data-testid="scroll-edge-shadow-bottom"
          className={cx(classes.edge, classes.bottom)}
          style={{ top: top + viewportHeight - SHADOW_HEIGHT, right }}
        />
      ) : null}
    </>
  )
}
