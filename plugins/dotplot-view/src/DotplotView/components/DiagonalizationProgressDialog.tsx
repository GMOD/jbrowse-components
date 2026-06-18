import { useState } from 'react'

import { Dialog, ErrorBanner } from '@jbrowse/core/ui'
import { statusMessageText } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import {
  Button,
  DialogActions,
  DialogContent,
  LinearProgress,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { runDotplotDiagonalize } from '../util/runDotplotDiagonalize.ts'

import type { DotplotViewModel } from '../model.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const DiagonalizationProgressDialog = observer(
  function DiagonalizationProgressDialog({
    handleClose,
    model,
  }: {
    handleClose: () => void
    model: DotplotViewModel
  }) {
    const [message, setMessage] = useState('Ready to start diagonalization')
    const [error, setError] = useState<unknown>()
    const [isRunning, setIsRunning] = useState(false)
    const [stopToken, setStopToken] = useState<StopToken>()

    const handleStart = async () => {
      const token = createStopToken()
      setStopToken(token)

      try {
        setIsRunning(true)
        setMessage('Preparing diagonalization...')
        const result = await runDotplotDiagonalize(model, {
          stopToken: token,
          statusCallback: msg => {
            setMessage(statusMessageText(msg) ?? '')
          },
        })
        setMessage(
          result
            ? `Diagonalization complete! Reordered ${result.totalReordered} regions, reversed ${result.totalReversed}`
            : 'No regions to reorder',
        )
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
        title="Re-order chromosomes"
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
          {isRunning ? <LinearProgress style={{ marginTop: 16 }} /> : null}
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
