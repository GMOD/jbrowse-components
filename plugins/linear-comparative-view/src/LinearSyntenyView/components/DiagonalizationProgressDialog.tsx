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
      const runDiagonalization = async () => {
        const session = getSession(model)

        try {
          if (model.views.length < 2) {
            setError('Diagonalization requires at least 2 views')
            setProgress(100)
            return
          }

          const numLevels = model.levels.length
          let totalReversed = 0
          let totalReordered = 0

          for (let levelIdx = 0; levelIdx < numLevels; levelIdx++) {
            const refView = model.views[levelIdx]!
            const queryView = model.views[levelIdx + 1]!
            const level = model.levels[levelIdx]!

            const baseProgress = (levelIdx / numLevels) * 90
            const levelProgress = 90 / numLevels

            setProgress(baseProgress + 5)
            setMessage(
              `Collecting alignments for level ${levelIdx + 1}/${numLevels}...`,
            )

            const alignments: AlignmentData[] = []
            for (const track of level.tracks) {
              for (const display of track.displays) {
                const { featureData } = display as {
                  featureData?: {
                    refNames: string[]
                    starts: Uint32Array
                    ends: Uint32Array
                    strands: Int8Array
                    mateStarts: Uint32Array
                    mateEnds: Uint32Array
                    mateRefNames: string[]
                  }
                }

                if (featureData) {
                  for (let i = 0; i < featureData.refNames.length; i++) {
                    alignments.push({
                      queryRefName: featureData.refNames[i]!,
                      refRefName: featureData.mateRefNames[i]!,
                      queryStart: featureData.starts[i]!,
                      queryEnd: featureData.ends[i]!,
                      refStart: featureData.mateStarts[i]!,
                      refEnd: featureData.mateEnds[i]!,
                      strand: featureData.strands[i]! || 1,
                    })
                  }
                }
              }
            }

            if (alignments.length === 0) {
              continue
            }

            const result = await diagonalizeRegions(
              alignments,
              refView.displayedRegions,
              queryView.displayedRegions,
              async (prog, msg) => {
                setProgress(baseProgress + (prog / 100) * levelProgress)
                setMessage(`Level ${levelIdx + 1}/${numLevels}: ${msg}`)
              },
            )

            if (result.newRegions.length > 0) {
              transaction(() => {
                queryView.setDisplayedRegions(result.newRegions)
              })
              totalReversed += result.stats.regionsReversed
              totalReordered += result.stats.regionsReordered
            }
          }

          setProgress(100)
          setMessage(
            `Done: reordered ${totalReordered} regions, reversed ${totalReversed}`,
          )

          setTimeout(() => {
            handleClose()
          }, 1500)
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
            color="text.secondary"
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
