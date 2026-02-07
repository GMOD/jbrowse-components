import { LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { FeatureDensityStats } from '@jbrowse/core/data_adapters/BaseAdapter'

const useStyles = makeStyles()({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0, 0, 0, 0.05) 8px, rgba(0, 0, 0, 0.05) 16px)`,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
})

const LoadingOverlay = observer(function LoadingOverlay({
  model,
}: {
  model: {
    sources?: unknown[]
    featuresReady: boolean
    statusMessage?: string
    regionTooLarge: boolean
    regionTooLargeReason: string
    featureDensityStats?: FeatureDensityStats
    setFeatureDensityStatsLimit: (s?: FeatureDensityStats) => void
  }
}) {
  const { classes } = useStyles()
  const { sources, featuresReady, statusMessage, regionTooLarge } = model

  if (regionTooLarge) {
    return (
      <div className={classes.overlay}>
        <div>
          {[
            model.regionTooLargeReason,
            'Zoom in to see features or force load (may be slow)',
          ]
            .filter(f => !!f)
            .join('. ')}
        </div>
        <Button
          variant="contained"
          size="small"
          style={{ marginTop: 8 }}
          onClick={() => {
            if (isAlive(model)) {
              model.setFeatureDensityStatsLimit(model.featureDensityStats)
            }
          }}
        >
          Force load
        </Button>
      </div>
    )
  }

  const message =
    statusMessage ||
    (!sources
      ? 'Loading samples'
      : !featuresReady
        ? 'Loading features'
        : 'Computing display data')
  return (
    <div className={classes.overlay}>
      <LoadingEllipses message={message} />
    </div>
  )
})

export default LoadingOverlay
