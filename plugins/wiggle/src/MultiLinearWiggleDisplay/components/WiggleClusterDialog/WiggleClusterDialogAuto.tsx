import { ErrorBanner, StatusProgressBar } from '@jbrowse/core/ui'
import { statusFraction, statusProgressLabel } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import SamplesPerPixelField from './SamplesPerPixelField.tsx'
import { useClusterSamplingOptions } from './clusterOptions.ts'
import { useWiggleClusterRun } from './useWiggleClusterRun.ts'

import type { ReducedModel } from './types.ts'

const WiggleClusterDialogAuto = observer(function WiggleClusterDialogAuto({
  model,
  children,
  handleClose,
}: {
  model: ReducedModel
  children: React.ReactNode
  handleClose: () => void
}) {
  const { showAdvanced, setShowAdvanced, samplesPerPixel, setSamplesPerPixel } =
    useClusterSamplingOptions()
  const { status, error, loading, run, stop } = useWiggleClusterRun({
    model,
    samplesPerPixel,
    onSuccess: () => {
      handleClose()
    },
  })
  return (
    <>
      <DialogContent>
        {children}
        <div style={{ marginTop: 50 }}>
          <Button
            variant="contained"
            onClick={() => {
              setShowAdvanced(!showAdvanced)
            }}
          >
            {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
          </Button>
          {showAdvanced ? (
            <SamplesPerPixelField
              value={samplesPerPixel}
              onChange={val => {
                setSamplesPerPixel(val)
              }}
            />
          ) : null}
        </div>
        <div>
          {loading ? (
            <div style={{ padding: 50 }}>
              <span>{statusProgressLabel(status) || 'Loading...'}</span>
              <Button
                variant="contained"
                onClick={() => {
                  stop()
                }}
              >
                Stop
              </Button>
              <StatusProgressBar
                fraction={statusFraction(status)}
                style={{ marginTop: 8 }}
              />
            </div>
          ) : null}
          {error ? <ErrorBanner error={error} /> : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          disabled={loading}
          onClick={() => {
            void run()
          }}
        >
          Run clustering
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            stop()
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default WiggleClusterDialogAuto
