import { useState } from 'react'

import { Dialog, ErrorMessage } from '@jbrowse/core/ui'
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
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

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

interface RunDiagonalizationArgs {
  model: Pick<
    DotplotViewModel,
    'tracks' | 'hview' | 'vview' | 'id' | 'type' | 'displayName'
  >
  session: AbstractSessionModel
  stopToken?: StopToken
  setProgress: (progress: number) => void
  setMessage: (message: string) => void
}

async function runDiagonalization({
  model,
  session,
  stopToken,
  setProgress,
  setMessage,
}: RunDiagonalizationArgs) {
  setProgress(0)
  setMessage('Preparing diagonalization...')

  // Get first track's adapter config
  const track = model.tracks[0]
  if (!track) {
    throw new Error('No tracks found')
  }

  const display = track.displays[0]
  if (!display) {
    throw new Error('No display found')
  }

  // Call RPC method to run diagonalization on worker
  const result = (await session.rpcManager.call(
    model.id,
    'DiagonalizeDotplot',
    {
      sessionId: `diagonalize-${Date.now()}`,
      view: {
        hview: model.hview,
        vview: model.vview,
      },
      adapterConfig: display.adapterConfig,
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
    return result
  } else {
    throw new Error('No regions to reorder')
  }
}

const DiagonalizationProgressDialog = observer(
  function DiagonalizationProgressDialog({
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
    const [message, setMessage] = useState('Ready to start diagonalization')
    const [error, setError] = useState<unknown>()
    const [isRunning, setIsRunning] = useState(false)
    const [stopToken, setStopToken] = useState<StopToken>()

    const handleStart = async () => {
      const session = getSession(model)
      const token = createStopToken()
      setStopToken(token)

      try {
        setIsRunning(true)
        await runDiagonalization({
          model,
          session,
          stopToken: token,
          setProgress,
          setMessage,
        })

        // Auto-close after success
        setTimeout(() => {
          handleClose()
        }, 2000)
      } catch (err) {
        console.error(err)
        setError(err)
      } finally {
        setIsRunning(false)
      }
    }

    const handleCancel = () => {
      if (stopToken) {
        stopStopToken(stopToken)
        setStopToken(undefined)
      }
      handleClose()
    }

    const handleDialogClose = () => {
      // Only allow closing if not running
      if (!isRunning) {
        handleClose()
      }
    }

    return (
      <Dialog
        open
        title="Diagonalize Dotplot"
        onClose={handleDialogClose}
        maxWidth="lg"
      >
        <DialogContent style={{ minWidth: 400 }}>
          {message ? <Typography>{message}</Typography> : null}
          {error ? <ErrorMessage error={error} /> : null}
          {isRunning ? (
            <>
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
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          {!isRunning ? (
            <>
              <Button
                onClick={handleClose}
                color="secondary"
                variant="contained"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  handleStart()
                }}
                color="primary"
                variant="contained"
              >
                Start
              </Button>
            </>
          ) : null}
          {isRunning ? (
            <Button
              onClick={handleCancel}
              color="secondary"
              variant="contained"
            >
              Cancel
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    )
  },
)

export default DiagonalizationProgressDialog
