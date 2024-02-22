import React from 'react'
import { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

// locals
import BlockMsg from '../components/BlockMsg'

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
      action={() => {
        model.setFeatureDensityStatsLimit(model.featureDensityStats)
        model.reload()
      }}
      buttonText="Force load"
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
