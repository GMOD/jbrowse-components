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
import { transaction } from 'mobx'
import { observer } from 'mobx-react'

import { diagonalizeRegions } from '../util/diagonalize.ts'

import type { LinearSyntenyViewModel } from '../model.ts'
import type { AlignmentData } from '../util/diagonalize.ts'

const DiagonalizationProgressDialog = observer(
  function DiagonalizationProgressDialog({
    handleClose,
    model,
  }: {
    handleClose: () => void
    model: LinearSyntenyViewModel
  }) {
    const [progress, setProgress] = useState(0)
    const [message, setMessage] = useState('Initializing...')
    const [error, setError] = useState<string>()

    useEffect(() => {
      // Run diagonalization on mount
      const runDiagonalization = async () => {
        const session = getSession(model)

        try {
          // Check we have exactly 2 views
          if (model.views.length !== 2) {
            setError('Diagonalization requires exactly 2 views')
            setProgress(100)
            session.notify(
              'Diagonalization requires exactly 2 views',
              'warning',
            )
            return
          }

          const queryView = model.views[1]!

          setProgress(5)
          setMessage('Collecting alignment data...')

          // Collect all alignment data from all synteny tracks
          const alignments: AlignmentData[] = []

          for (const level of model.levels) {
            for (const track of level.tracks) {
              for (const display of track.displays) {
                const { featPositions } = display as {
                  featPositions: {
                    f: {
                      get: (key: string) => unknown
                    }
                  }[]
                }

                for (const { f } of featPositions) {
                  const mate = f.get('mate') as {
                    refName: string
                    start: number
                    end: number
                  }

                  alignments.push({
                    queryRefName: f.get('refName') as string,
                    refRefName: mate.refName,
                    queryStart: f.get('start') as number,
                    queryEnd: f.get('end') as number,
                    refStart: mate.start,
                    refEnd: mate.end,
                    strand: (f.get('strand') as number) || 1,
                  })
                }
              }
            }
          }

          if (alignments.length === 0) {
            setError('No alignments found')
            setProgress(100)
            session.notify('No alignments found to diagonalize', 'warning')
            return
          }

          // Call the utility function with progress callback
          const result = await diagonalizeRegions(
            alignments,
            queryView.displayedRegions,
            async (prog, msg) => {
              setProgress(prog)
              setMessage(msg)
            },
          )

          // Apply the new ordering
          if (result.newRegions.length > 0) {
            setProgress(95)
            setMessage('Applying new layout...')
            transaction(() => {
              queryView.setDisplayedRegions(result.newRegions)
            })
            setProgress(100)
            setMessage('Diagonalization complete')

            // Auto-close after success
            setTimeout(() => {
              handleClose()
            }, 1500)
          } else {
            setError('No regions to reorder')
            setProgress(100)
            session.notify('No query regions found to reorder', 'warning')
          }
        } catch (err) {
          console.error('Diagonalization error:', err)
          setError(`Error: ${err}`)
          setProgress(100)
          session.notify(`Diagonalization failed: ${err}`, 'error')
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      runDiagonalization()
    }, [model, handleClose])

    return (
      <Dialog open title="Diagonalizing" onClose={handleClose}>
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
          <Button
            onClick={handleClose}
            color="primary"
            disabled={progress < 100}
          >
            {progress < 100 ? 'Processing...' : 'Done'}
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default DiagonalizationProgressDialog
