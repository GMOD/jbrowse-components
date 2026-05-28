import { useEffect, useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  DialogActions,
  DialogContent,
  LinearProgress,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { runDiagonalize } from '../util/runDiagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'

const DiagonalizationProgressDialog = observer(
  function DiagonalizationProgressDialog({
    handleClose,
    model,
  }: {
    handleClose: () => void
    model: LinearSyntenyViewModel
  }) {
    const [done, setDone] = useState(false)
    const [message, setMessage] = useState('Reordering chromosomes...')
    const [error, setError] = useState<string>()

    useEffect(() => {
      let cancelled = false
      const run = async () => {
        try {
          if (model.views.length < 2) {
            setError('Diagonalization requires at least 2 views')
            setDone(true)
            return
          }

          // Yield so the LinearProgress paints before the synchronous
          // collect+diagonalize work blocks the main thread.
          await new Promise(resolve => {
            setTimeout(resolve, 0)
          })

          const stats = await runDiagonalize(model)
          if (cancelled) {
            return
          }

          setMessage(
            stats
              ? `Done: reordered ${stats.totalReordered} regions, reversed ${stats.totalReversed}`
              : 'No alignments to diagonalize',
          )
          setDone(true)
          setTimeout(() => {
            if (!cancelled) {
              handleClose()
            }
          }, 1500)
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
      }
    }, [model, handleClose])

    return (
      <Dialog open title="Re-order chromosomes" onClose={handleClose}>
        <DialogContent style={{ minWidth: 400 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Reorders the bottom assembly to match the top. Uses alignment data
            currently loaded in the view — zoom out to show whole chromosomes
            for best results.
          </Typography>
          <Typography
            variant="body1"
            gutterBottom
            color={error ? 'error' : 'inherit'}
          >
            {error ?? message}
          </Typography>
          {done ? null : <LinearProgress style={{ marginTop: 16 }} />}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              handleClose()
            }}
            color="primary"
            disabled={!done}
          >
            {done ? 'Done' : 'Processing...'}
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default DiagonalizationProgressDialog
