import { useState } from 'react'

import { Dialog, ErrorBanner } from '@jbrowse/core/ui'
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

import type { DiagonalizeDotplotArgs } from '../../DiagonalizeDotplotRpc.ts'
import type { DotplotViewModel } from '../model.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

interface RunDiagonalizationArgs {
  model: Pick<
    DotplotViewModel,
    'tracks' | 'hview' | 'vview' | 'id' | 'type' | 'displayName'
  >
  session: AbstractSessionModel
  stopToken?: StopToken
  setMessage: (message: string) => void
}

async function runDiagonalization({
  model,
  session,
  stopToken,
  setMessage,
}: RunDiagonalizationArgs) {
  setMessage('Preparing diagonalization...')

  const track = model.tracks[0]
  if (!track) {
    throw new Error('No tracks found')
  }

  const display = track.displays[0]
  if (!display) {
    throw new Error('No display found')
  }

  const result = await session.rpcManager.call(model.id, 'DiagonalizeDotplot', {
    sessionId: `diagonalize-${Date.now()}`,
    view: {
      hview: model.hview,
      vview: model.vview,
    },
    adapterConfig: display.adapterConfig,
    stopToken,
    statusCallback: setMessage,
  } satisfies DiagonalizeDotplotArgs)

  setMessage('Applying new layout...')

  if (result.newRegions.length > 0) {
    transaction(() => {
      model.vview.setDisplayedRegions(result.newRegions)
    })
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
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Reorders the vertical axis to match the horizontal. Uses all
            alignments across the currently displayed chromosomes.
          </Typography>
          {message ? <Typography>{message}</Typography> : null}
          {error ? <ErrorBanner error={error} /> : null}
          {isRunning ? (
            <LinearProgress
              style={{ marginTop: 16 }}
              color={error ? 'error' : 'primary'}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          {isRunning ? (
            <Button
              onClick={handleCancel}
              color="secondary"
              variant="contained"
            >
              Cancel
            </Button>
          ) : (
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
          )}
        </DialogActions>
      </Dialog>
    )
  },
)

export default DiagonalizationProgressDialog
