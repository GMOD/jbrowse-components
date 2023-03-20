import React from 'react'
import { Stats } from '@jbrowse/core/data_adapters/BaseAdapter'

// locals
import BlockMsg from '../components/BlockMsg'

function TooLargeMessage({
  model,
}: {
  model: {
    regionTooLargeReason: string
    estimatedRegionsStats?: Stats
    updateStatsLimit: (s?: Stats) => void
    reload: () => void
  }
}) {
  const { regionTooLargeReason } = model
  return (
    <BlockMsg
      severity="warning"
      action={() => {
        model.updateStatsLimit(model.estimatedRegionsStats)
        model.reload()
      }}
      buttonText="Force load"
      message={`${regionTooLargeReason ? `${regionTooLargeReason}. ` : ''}
      Zoom in to see features or force load (may be slow).`}
    />
  )
}

export default TooLargeMessage
