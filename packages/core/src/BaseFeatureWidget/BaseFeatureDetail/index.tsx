import { useState } from 'react'

import { observer } from 'mobx-react'

import { ErrorBanner } from '../../ui/index.ts'
import { alpha } from '../../ui/palette.ts'
import { keyframes, makeStyles } from '../../util/tss-react/index.ts'
import FeatureDetails from './FeatureDetails.tsx'
import { isEmpty } from './util.ts'

import type { Descriptors } from '../types.tsx'
import type { BaseInputProps } from './types.ts'

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
    // Over the whole panel rather than over its title: the drawer keeps its
    // scroll offset across a feature change (nothing remounts, so `scrollTop`
    // survives), and a cue drawn on the title is off-screen for anyone reading
    // attributes further down -- which is exactly who cannot tell that the
    // panel updated.
    wash: {
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      animation: `${wash} ${WASH_MS}ms ease-out`,
    },
  }
})

const BaseFeatureDetail = observer(function BaseFeatureDetail({
  model,
}: BaseInputProps) {
  const { classes } = useStyles()
  const { error, featureData } = model
  // annotated to shed the MST node brand types.frozen() carries on the instance
  const descriptions: Descriptors | undefined = model.descriptions
  const uniqueId = featureData?.uniqueId

  // Keyed on the feature's identity, not on `featureData` itself: the widget's
  // autorun rewrites that object whenever the formatDetails callbacks
  // re-resolve, and a re-format of the feature already on screen is not a
  // change the user made.
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

  // A field is hidden by a formatDetails callback returning undefined (jexl
  // can't produce null); every detail component filters with `!= null`, so a
  // field set to undefined (live) or null (round-tripped through a snapshot) is
  // dropped identically.
  if (error) {
    return <ErrorBanner error={error} />
  } else if (!featureData || isEmpty(featureData)) {
    return null
  } else {
    return (
      <div className={classes.root}>
        <FeatureDetails
          model={model}
          feature={featureData}
          descriptions={descriptions}
        />
        {/* nothing until the first change, so a panel opened and left alone
        draws no extra element */}
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
})

export default BaseFeatureDetail

export { default as BaseCard } from './BaseCard.tsx'
export { default as BaseAttributes } from './BaseAttributes.tsx'
export { default as BaseCoreDetails } from './BaseCoreDetails.tsx'
export { default as FeatureDetails } from './FeatureDetails.tsx'
