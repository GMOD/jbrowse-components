import { useEffect, useState } from 'react'

import { Dialog, StatusProgressBar } from '@jbrowse/core/ui'
import { getSession, statusProgressLabel } from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { runDiagonalize } from '../util/runDiagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { RpcStatus } from '@jbrowse/core/util'

const DiagonalizationProgressDialog = observer(
  function DiagonalizationProgressDialog({
    handleClose,
    model,
  }: {
    handleClose: () => void
    model: LinearSyntenyViewModel
  }) {
    const [done, setDone] = useState(false)
    const [status, setStatus] = useState<RpcStatus>('Reordering chromosomes...')
    const [error, setError] = useState<string>()

    useEffect(() => {
      let cancelled = false
      const stopToken = createStopToken()
      const run = async () => {
        try {
          if (model.views.length < 2) {
            setError('Diagonalization requires at least 2 views')
            setDone(true)
            return
          }

          const stats = await runDiagonalize(model, {
            stopToken,
            statusCallback: msg => {
              if (!cancelled) {
                setStatus(msg)
              }
            },
          })
          if (cancelled) {
            return
          }

          setStatus(
            stats
              ? `Done: reordered ${stats.totalReordered} regions, reversed ${stats.totalReversed}`
              : 'No alignments to diagonalize',
          )
          setDone(true)
        } catch (err) {
          if (cancelled) {
            return
          }
          console.error('Diagonalization error:', err)
          setError(`${err}`)
          setDone(true)
          getSession(model).notify(`Diagonalization failed: ${err}`, 'error')
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      run()
      return () => {
        cancelled = true
        stopStopToken(stopToken)
      }
    }, [model])

    return (
      <Dialog open title="Re-order chromosomes" onClose={handleClose}>
        <DialogContent style={{ minWidth: 400 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Reorders the bottom assembly to match the top, using all alignment
            data across the currently displayed chromosomes.
          </Typography>
          <Typography
            variant="body1"
            gutterBottom
            color={error ? 'error' : 'inherit'}
          >
            {error ?? statusProgressLabel(status)}
          </Typography>
          {done ? null : (
            <StatusProgressBar status={status} style={{ marginTop: 16 }} />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              handleClose()
            }}
            color="primary"
            disabled={!done}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default DiagonalizationProgressDialog
