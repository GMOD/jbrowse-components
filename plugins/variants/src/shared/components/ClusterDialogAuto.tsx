import { useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import {
  getContainingView,
  getSession,
  isAbortException,
} from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'
import { isAlive } from 'mobx-state-tree'

import type { Source } from '../types'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

interface AutoClusterButtonProps {
  model: {
    sourcesWithoutLayout?: Source[]
    minorAlleleFrequencyFilter?: number
    adapterConfig: AnyConfigurationModel
    setLayout: (arg: Source[]) => void
    clearLayout: () => void
  }
  setPaste: (paste: string) => void
  children: React.ReactNode
  handleClose: () => void
}

const ClusterDialogAuto = observer(function ({
  model,
  children,
  handleClose,
}: AutoClusterButtonProps) {
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<unknown>()

  return (
    <>
      <DialogContent>
        {children}
        <div>
          {progress ? (
            <div style={{ padding: 100 }}>Progress: {progress}</div>
          ) : null}
          {error ? <ErrorMessage error={error} /> : null}
        </div>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={async () => {
            try {
              setError(undefined)
              const view = getContainingView(model) as LinearGenomeViewModel
              if (!view.initialized) {
                return
              }
              const { rpcManager } = getSession(model)
              const {
                sourcesWithoutLayout,
                minorAlleleFrequencyFilter,
                adapterConfig,
              } = model
              if (sourcesWithoutLayout) {
                const sessionId = getRpcSessionId(model)
                const ret = (await rpcManager.call(
                  sessionId,
                  'MultiVariantClusterGenotypeMatrix',
                  {
                    regions: view.dynamicBlocks.contentBlocks,
                    sources: sourcesWithoutLayout,
                    minorAlleleFrequencyFilter,
                    sessionId,
                    adapterConfig,
                    statusCallback: (arg: string) => {
                      setProgress(arg)
                    },
                  },
                )) as { order: number[] }

                model.setLayout(
                  ret.order.map(idx => {
                    const ret = sourcesWithoutLayout[idx]
                    if (!ret) {
                      throw new Error(`out of bounds at ${idx}`)
                    }
                    return ret
                  }),
                )
              }
            } catch (e) {
              if (!isAbortException(e) && isAlive(model)) {
                console.error(e)
                setError(e)
              }
            } finally {
              setProgress('')
            }

            handleClose()
          }}
        >
          Run clustering
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            handleClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default ClusterDialogAuto
