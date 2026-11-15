import { Fragment } from 'react'

import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { ErrorBanner } from '../../ui/index.ts'
import FeatureWash from './FeatureWash.tsx'
import { FeatureTrackContext, featureKey } from './featureKey.ts'
import { isEmpty } from './util.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type React from 'react'

export interface FeatureDetailsFrameModel {
  error?: unknown
  featureData?: SimpleFeatureSerialized
  unformattedFeatureData?: SimpleFeatureSerialized
  trackId?: string
}

/**
 * The shell of a feature-details widget: the error and no-feature states, the
 * wash played on a swap, and the body. A function body is handed the feature
 * as the panel shows it and as the click delivered it, and is keyed on the
 * feature, so its UI state resets when the reused widget swaps to the next
 * one. A node body is not keyed: the base widget's sequence panel stays open
 * across clicks.
 */
const FeatureDetailsFrame = observer(function FeatureDetailsFrame({
  model,
  children,
}: {
  model: FeatureDetailsFrameModel
  children:
    | React.ReactNode
    | ((
        feature: SimpleFeatureSerialized,
        unformatted: SimpleFeatureSerialized,
      ) => React.ReactNode)
}) {
  const { error, featureData, unformattedFeatureData, trackId } = model
  return !featureData || isEmpty(featureData) ? (
    error ? (
      <ErrorBanner error={error} />
    ) : (
      <Paper sx={{ p: 2 }}>
        <Typography>
          No feature loaded. It may not be available after a page refresh
          because it was too large to persist in localStorage.
        </Typography>
      </Paper>
    )
  ) : (
    <FeatureTrackContext value={trackId}>
      <FeatureWash uniqueId={featureKey(trackId, featureData.uniqueId)}>
        {error ? <ErrorBanner error={error} /> : null}
        {typeof children === 'function' ? (
          <Fragment key={featureKey(trackId, featureData.uniqueId)}>
            {children(featureData, unformattedFeatureData ?? featureData)}
          </Fragment>
        ) : (
          children
        )}
      </FeatureWash>
    </FeatureTrackContext>
  )
})

export default FeatureDetailsFrame
