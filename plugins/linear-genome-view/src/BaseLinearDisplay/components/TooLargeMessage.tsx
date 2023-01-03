import React from 'react'
import BlockMsg from '../components/BlockMsg'
import { Stats } from '@jbrowse/core/data_adapters/BaseAdapter'

function TooLargeMessage({
  model,
}: {
  model: {
    regionTooLargeReason: string
    estimatedRegionStats?: Stats
    updateStatsLimit: (s: Stats) => void
    reload: () => void
  }
}) {
  const { regionTooLargeReason } = model
  return (
    <BlockMsg
      severity="warning"
      action={() => {
        if (!model.estimatedRegionStats) {
          console.error('No global stats?')
        } else {
          model.updateStatsLimit(model.estimatedRegionStats)
          model.reload()
        }
      }}
      buttonText="Force load"
      message={`${regionTooLargeReason ? regionTooLargeReason + '. ' : ''}
      Zoom in to see features or force load (may be slow).`}
    />
  )
}

export default TooLargeMessage
