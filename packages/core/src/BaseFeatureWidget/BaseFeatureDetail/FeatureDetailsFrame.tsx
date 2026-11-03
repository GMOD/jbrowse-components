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
}

const FeatureDetailsFrame = observer(function FeatureDetailsFrame({
  model,
  children,
}: {
  model: FeatureDetailsFrameModel
  children: React.ReactNode
}) {
  const { error, featureData } = model
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
    <FeatureWash uniqueId={featureData.uniqueId}>
      {error ? <ErrorBanner error={error} /> : null}
      {children}
    </FeatureWash>
  )
})

export default FeatureDetailsFrame
