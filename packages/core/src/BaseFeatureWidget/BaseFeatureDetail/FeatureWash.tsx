import { useState } from 'react'

import { alpha } from '../../ui/palette.ts'
import { keyframes, makeStyles } from '../../util/tss-react/index.ts'

// Long enough to register out of the corner of an eye that was on the track,
// short enough that a run of clicks doesn't leave the panel permanently tinted.
const WASH_MS = 550

const useStyles = makeStyles()(theme => {
  // No `prefers-reduced-motion` branch, deliberately. Nothing here moves,
  // scales or travels -- a background color fading out is not motion, and that
  // setting's subject is motion. Dropping the cue for reduced-motion users
  // would take away the only thing telling them the panel answered their
  // click, which is the failure mode that asked for this in the first place.
  const wash = keyframes`
    from { background-color: ${alpha(theme.palette.quaternary.main, 0.15)}; }
    to { background-color: ${alpha(theme.palette.quaternary.main, 0)}; }
  `
  return {
    root: {
      position: 'relative',
    },
    wash: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      animation: `${wash} ${WASH_MS}ms ease-out`,
    },
  }
})

/**
 * A one-shot tint over a feature-details panel, played when the panel swaps to
 * a different feature.
 *
 * Every feature widget is a singleton the drawer reuses -- one id per widget
 * type, rendered without a key -- so clicking a second feature remounts
 * nothing. The drawer keeps its scroll offset with it, and on a dense panel the
 * content can change entirely below the fold with nothing on screen saying it
 * did. The cue covers the whole panel rather than its title for that reason:
 * a title is off-screen for exactly the reader who cannot tell it updated.
 *
 * **Mount this outside anything keyed on the feature.** Some widgets key their
 * body on `uniqueId` to reset per-feature UI state (variants does, for its
 * sample grid); inside such a key this remounts on every swap and its counter
 * never leaves zero, so it silently never plays.
 */
export default function FeatureWash({
  uniqueId,
  children,
}: {
  uniqueId: string | undefined
  children: React.ReactNode
}) {
  const { classes } = useStyles()
  // Keyed on the feature's identity, not on the feature object: a widget's
  // formatDetails callbacks re-resolve into a fresh object, and a re-format of
  // the feature already on screen is not a change the user made.
  //
  // `count` doubles as the restart key -- a class alone won't replay an
  // animation already on the element, which is what clicking between two
  // features is. Adjusted during render rather than from an effect, so a
  // StrictMode host's doubled mount can't wash a panel nobody clicked.
  const [wash, setWash] = useState({ shownFor: uniqueId, count: 0 })
  if (wash.shownFor !== uniqueId) {
    setWash({
      shownFor: uniqueId,
      // a panel filling for the first time is not an update -- there was
      // nothing on screen to mistake for the feature that just arrived
      count: wash.shownFor === undefined ? 0 : wash.count + 1,
    })
  }
  return (
    <div className={classes.root}>
      {children}
      {/* nothing until the first swap, so a panel opened and left alone draws
      no extra element */}
      {wash.count ? (
        <span
          key={wash.count}
          className={classes.wash}
          data-testid="feature-details-wash"
        />
      ) : null}
    </div>
  )
}
