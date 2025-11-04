import { useEffect, useRef, useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  Button,
  DialogActions,
  DialogContent,
  LinearProgress,
  Typography,
} from '@mui/material'
import { transaction } from 'mobx'
import { getSnapshot } from 'mobx-state-tree'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model'

interface Region {
  refName: string
  start: number
  end: number
  reversed?: boolean
  assemblyName: string
}

interface DiagonalizationResult {
  newRegions: Region[]
  stats: {
    totalAlignments: number
    regionsProcessed: number
    regionsReordered: number
    regionsReversed: number
  }
}

const DiagonalizationProgressDialog = observer(function ({
  handleClose,
  model,
}: {
  handleClose: () => void
  model: Pick<
    DotplotViewModel,
    'tracks' | 'hview' | 'vview' | 'id' | 'type' | 'displayName'
  >
}) {
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('Initializing...')
  const [error, setError] = useState<string>()
  const [isComplete, setIsComplete] = useState(false)
  const stopTokenRef = useRef(createStopToken())

  useEffect(() => {
    // Run diagonalization on mount
    const runDiagonalization = async () => {
      const session = getSession(model)
      const stopToken = stopTokenRef.current

      try {
        setMessage('Preparing diagonalization...')

        // Get first track's adapter config
        const track = model.tracks[0]
        if (!track) {
          setError('No tracks found')
          setIsComplete(true)
          session.notify('No tracks found to diagonalize', 'warning')
          return
        }

        const display = track.displays[0]
        if (!display) {
          setError('No display found')
          setIsComplete(true)
          session.notify('No display found', 'warning')
          return
        }

        // Call RPC method to run diagonalization on worker
        const result = (await session.rpcManager.call(
          model.id,
          'DiagonalizeDotplot',
          {
            sessionId: `diagonalize-${Date.now()}`,
            view: {
              hview: getSnapshot(model.hview),
              vview: getSnapshot(model.vview),
            },
            adapterConfig: getSnapshot(display.adapterConfig),
            stopToken,
            statusCallback: (msg: string) => {
              setMessage(msg)
              // Estimate progress based on message
              if (msg.includes('Initializing')) {
                setProgress(5)
              } else if (msg.includes('Getting renderer')) {
                setProgress(10)
              } else if (msg.includes('Fetching features')) {
                setProgress(20)
              } else if (msg.includes('Extracting')) {
                setProgress(30)
              } else if (msg.includes('Running diagonalization')) {
                setProgress(40)
              } else if (msg.includes('Grouping')) {
                setProgress(50)
              } else if (msg.includes('Determining')) {
                setProgress(65)
              } else if (msg.includes('Sorting')) {
                setProgress(80)
              } else if (msg.includes('Building')) {
                setProgress(90)
              } else if (msg.includes('complete')) {
                setProgress(100)
              }
            },
          },
        )) as DiagonalizationResult

        setMessage('Applying new layout...')
        setProgress(95)

        // Apply the new ordering
        if (result.newRegions.length > 0) {
          transaction(() => {
            model.vview.setDisplayedRegions(result.newRegions)
          })
          setProgress(100)
          setMessage(
            `Diagonalization complete! Reordered ${result.stats.regionsReordered} regions, reversed ${result.stats.regionsReversed}`,
          )
          setIsComplete(true)

          // Auto-close after success
          setTimeout(() => {
            handleClose()
          }, 2000)
        } else {
          setError('No regions to reorder')
          setIsComplete(true)
          session.notify('No regions found to reorder', 'warning')
        }
      } catch (err) {
        console.error('Diagonalization error:', err)
        const errMsg = `${err}`
        setError(errMsg.includes('aborted') ? 'Cancelled by user' : `Error: ${err}`)
        setIsComplete(true)
        if (!errMsg.includes('aborted')) {
          session.notify(`Diagonalization failed: ${err}`, 'error')
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    runDiagonalization()

    // Cleanup stop token on unmount
    return () => {
      stopStopToken(stopTokenRef.current)
    }
  }, [model, handleClose])

  const handleCancel = () => {
    stopStopToken(stopTokenRef.current)
    handleClose()
  }

  return (
    <Dialog open title="Diagonalizing" onClose={handleCancel}>
      <DialogContent style={{ minWidth: 400 }}>
        <Typography
          variant="body1"
          gutterBottom
          color={error ? 'error' : 'inherit'}
        >
          {error || message}
        </Typography>
        <LinearProgress
          variant="determinate"
          value={progress}
          style={{ marginTop: 16 }}
          color={error ? 'error' : 'primary'}
        />
        <Typography
          variant="caption"
          color="textSecondary"
          style={{ marginTop: 8, display: 'block' }}
        >
          {Math.round(progress)}% complete
        </Typography>
      </DialogContent>
      <DialogActions>
        {!isComplete ? (
          <Button onClick={handleCancel} color="secondary">
            Cancel
          </Button>
        ) : null}
        <Button onClick={handleClose} color="primary" disabled={!isComplete}>
          {isComplete ? 'Done' : 'Processing...'}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default DiagonalizationProgressDialog
