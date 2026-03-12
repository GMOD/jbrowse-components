import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import BlockMsg from './BlockMsg.tsx'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

const TooLargeMessage = observer(function TooLargeMessage({
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
            if (isAlive(model)) {
              model.setFeatureDensityStatsLimit(model.featureDensityStats)
              model.reload()
            }
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
})

export default TooLargeMessage
