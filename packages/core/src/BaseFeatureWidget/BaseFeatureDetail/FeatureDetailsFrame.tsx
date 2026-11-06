import { Fragment } from 'react'

import { Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { ErrorBanner } from '../../ui/index.ts'
import FeatureWash from './FeatureWash.tsx'
import { isEmpty } from './util.ts'

import type { SimpleFeatureSerialized } from '../../util/index.ts'
import type React from 'react'

export interface FeatureDetailsFrameModel {
  error?: unknown
  featureData?: SimpleFeatureSerialized
  trackId?: string
}

/**
 * Wraps a feature widget's body, keyed on the shown feature so every
 * per-feature UI state below resets when the reused widget swaps features. A
 * feature id is unique only within its track, so the key names the track too.
 */

const FeatureDetailsFrame = observer(function FeatureDetailsFrame({
  model,
  children,
}: {
  model: FeatureDetailsFrameModel
  children: React.ReactNode
}) {
  const { error, featureData, trackId } = model
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
    <FeatureWash uniqueId={`${trackId ?? ''}/${featureData.uniqueId}`}>
      {error ? <ErrorBanner error={error} /> : null}
      <Fragment key={`${trackId ?? ''}/${featureData.uniqueId}`}>
        {children}
      </Fragment>
    </FeatureWash>
  )
})

export default FeatureDetailsFrame
