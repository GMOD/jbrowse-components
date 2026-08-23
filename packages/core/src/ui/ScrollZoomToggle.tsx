import { useState } from 'react'

import ZoomInMapIcon from '@mui/icons-material/ZoomInMap'
import { ToggleButton, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import { keyframes, makeStyles } from '../util/tss-react/index.ts'
import { alpha } from './palette.ts'
import { SCROLL_ZOOM_HELP, SCROLL_ZOOM_LABEL } from './scrollZoomLabels.ts'

// Two beats: one is a blink that a peripheral eye can miss, three outstays a
// confirmation.
const PULSE_MS = 550
const PULSE_COUNT = 2

const useStyles = makeStyles()(theme => {
  // The accent, not `primary`: JBrowse's primary is a near-black navy, and a
  // ring in it reads as a drop shadow rather than as something asking to be
  // looked at.
  const ringColor = alpha(theme.palette.secondary.main, 0.7)
  // Grows outward from the button's own edge, which is what carries the eye to
  // it — a ring drawn at its final size only appears there.
  const ring = keyframes`
    from { box-shadow: 0 0 0 0 ${ringColor}; }
    to { box-shadow: 0 0 0 9px ${alpha(theme.palette.secondary.main, 0)}; }
  `
  // What the same cue looks like for someone who asked for less motion: the
  // ring is there at one size and fades. Reduced motion is about movement, not
  // about being told less.
  const steadyRing = keyframes`
    from { box-shadow: 0 0 0 4px ${ringColor}; }
    to { box-shadow: 0 0 0 4px ${alpha(theme.palette.secondary.main, 0)}; }
  `
  return {
    button: {
      border: 'none',
      textTransform: 'none',
      whiteSpace: 'nowrap',
      gap: 4,
    },
    pulse: {
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      pointerEvents: 'none',
      animation: `${ring} ${PULSE_MS}ms ease-out ${PULSE_COUNT}`,
      '@media (prefers-reduced-motion: reduce)': {
        animation: `${steadyRing} ${PULSE_MS * PULSE_COUNT}ms ease-out`,
      },
    },
  }
})

/**
 * What a view reads and writes to offer scroll-to-zoom. Duck-typed rather than
 * a model, like the rest of the wheel-zoom layer — every view here delegates
 * both to the session, which is where the preference lives.
 */
export interface ScrollZoomToggleModel {
  scrollZoom: boolean
  setScrollZoom: (flag: boolean) => void
}

/**
 * The persistent control for scroll-to-zoom, shared by every view that has one.
 *
 * **Carries its own label.** Scroll-to-zoom is off by default, so a wheel over
 * the tracks does nothing until someone finds this — and the words in the header
 * are the whole of how they find it. An icon alone is not findable, whichever
 * icon: the glyph says "zoom" at best and nothing at all about the wheel. The
 * tooltip is where ctrl/⌘+scroll, which zooms whatever the preference says, is
 * named.
 *
 * **And it pulses when the preference changes.** The other ways to write it are
 * somewhere else on the screen — a view menu, the Preferences dialog — so the
 * moment the setting is learned is also the moment this button is not being
 * looked at. The ring is what connects the two: it says the thing you just
 * turned on lives *here*, which is what a user who wants it back off has to
 * know. Its own click pulses too — the answer to "where is this" should not
 * depend on which of the several places wrote it, and the other views' copies
 * of this button pulse with it, which is the preference being session-wide made
 * visible.
 *
 * `iconOnly` is for a header where this sits inside a run of icon buttons (the
 * comparative views), where a single labelled button reads as a mistake rather
 * than as emphasis. The tooltip carries the same words either way.
 */
const ScrollZoomToggle = observer(function ScrollZoomToggle({
  model,
  iconOnly,
}: {
  model: ScrollZoomToggleModel
  iconOnly?: boolean
}) {
  const { classes } = useStyles()
  const { scrollZoom } = model
  // `count` doubles as the restart key — a class alone won't replay a CSS
  // animation that is already on the element, which is the toggle flipped twice
  // in a row. Adjusted during render rather than from an effect, so a
  // StrictMode host's doubled mount effect can't pulse a button nobody touched.
  const [pulse, setPulse] = useState({ shownFor: scrollZoom, count: 0 })
  if (pulse.shownFor !== scrollZoom) {
    setPulse({ shownFor: scrollZoom, count: pulse.count + 1 })
  }
  // `describeChild` once the label is visible: MUI's default puts the title on
  // the child as its `aria-label`, which would replace the words on the button
  // with a paragraph that doesn't contain them. Described, not named.
  return (
    <Tooltip title={SCROLL_ZOOM_HELP} describeChild={!iconOnly}>
      <ToggleButton
        value="scrollZoom"
        selected={scrollZoom}
        onChange={() => {
          model.setScrollZoom(!scrollZoom)
        }}
        className={classes.button}
        size="small"
      >
        <ZoomInMapIcon fontSize="small" />
        {iconOnly ? null : SCROLL_ZOOM_LABEL}
        {/* nothing until the first change, so a view that renders this and is
        never touched draws no extra element */}
        {pulse.count ? (
          <span
            key={pulse.count}
            className={classes.pulse}
            data-testid="scroll-zoom-pulse"
          />
        ) : null}
      </ToggleButton>
    </Tooltip>
  )
})

export default ScrollZoomToggle
