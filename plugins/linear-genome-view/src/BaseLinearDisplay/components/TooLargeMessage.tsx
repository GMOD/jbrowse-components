import React from 'react'

// locals
import { Button } from '@mui/material'
import BlockMsg from '../components/BlockMsg'
import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

function TooLargeMessage({
  model,
}: {
  model: {
    regionTooLargeReason: string
    featureDensityStats?: FeatureDensityStats
    setFeatureDensityStatsLimit: (s?: FeatureDensityStats) => void
    reload: () => void
  }
}) {
  const { regionTooLargeReason } = model
  return (
    <BlockMsg
      severity="warning"
      action={
        <Button
          onClick={() => {
            model.setFeatureDensityStatsLimit(model.featureDensityStats)
            model.reload()
          }}
        >
          Force load
        </Button>
      }
      message={[
        regionTooLargeReason,
        'Zoom in to see features or force load (may be slow)',
      ]
        .filter(f => !!f)
        .join('. ')}
    />
  )
}

export default TooLargeMessage
