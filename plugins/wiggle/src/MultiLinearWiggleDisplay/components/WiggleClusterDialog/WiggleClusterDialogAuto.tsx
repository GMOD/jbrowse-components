import { ErrorBanner } from '@jbrowse/core/ui'
import { getContainingView, getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { ClusterProgress, useClusterRun } from '@jbrowse/tree-sidebar'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { runWiggleClustering } from '../../runWiggleClustering.ts'
import SamplesPerPixelField from './SamplesPerPixelField.tsx'
import { useClusterSamplingOptions } from './clusterOptions.ts'

import type { ReducedModel } from './types.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

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
  const { status, error, loading, run, stop } = useClusterRun({
    model,
    onSuccess: () => {
      handleClose()
    },
    run: async ({ stopToken, statusCallback }) => {
      const view = getContainingView(model) as LinearGenomeViewModel
      if (!view.initialized) {
        throw new Error(
          'The view is not initialized yet, please wait and try again',
        )
      }
      if (model.sourcesWithoutLayout.length < 2) {
        throw new Error('Need at least two subtracks to cluster')
      }
      await runWiggleClustering({
        model,
        rpcManager: getSession(model).rpcManager,
        sessionId: getRpcSessionId(model),
        samplesPerPixel,
        stopToken,
        statusCallback,
      })
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
            <ClusterProgress
              status={status}
              onStop={() => {
                stop()
              }}
            />
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
