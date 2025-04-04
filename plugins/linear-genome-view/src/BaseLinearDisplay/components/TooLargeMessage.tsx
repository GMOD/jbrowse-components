import { Button } from '@mui/material'
import { observer } from 'mobx-react'
import { isAlive } from '@jbrowse/mobx-state-tree'

import BlockMsg from '../components/BlockMsg'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

const TooLargeMessage = observer(function ({
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
