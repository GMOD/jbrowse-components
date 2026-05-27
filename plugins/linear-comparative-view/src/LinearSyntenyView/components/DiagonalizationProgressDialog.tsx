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

import type { SyntenyFeatureData } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearSyntenyViewModel } from '../model.ts'
import type { AlignmentData } from '../util/diagonalize.ts'

function collectAlignments(
  level: LinearSyntenyViewModel['levels'][number],
): AlignmentData[] {
  const alignments: AlignmentData[] = []
  for (const track of level.tracks) {
    for (const display of track.displays) {
      const featureData = (display as { featureData?: SyntenyFeatureData })
        .featureData
      if (!featureData) {
        continue
      }
      for (let i = 0; i < featureData.refNames.length; i++) {
        alignments.push({
          refRefName: featureData.refNames[i]!,
          queryRefName: featureData.mateRefNames[i]!,
          refStart: featureData.starts[i]!,
          refEnd: featureData.ends[i]!,
          queryStart: featureData.mateStarts[i]!,
          queryEnd: featureData.mateEnds[i]!,
          strand: featureData.strands[i]!,
        })
      }
    }
  }
  return alignments
}

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

          const perLevel: {
            queryView: LinearSyntenyViewModel['views'][number]
            result: Awaited<ReturnType<typeof diagonalizeRegions>>
          }[] = []
          for (const [i, level] of model.levels.entries()) {
            if (cancelled) {
              return
            }
            const alignments = collectAlignments(level)
            if (alignments.length > 0) {
              const queryView = model.views[i + 1]!
              const result = await diagonalizeRegions(
                alignments,
                model.views[i]!.displayedRegions,
                queryView.displayedRegions,
              )
              perLevel.push({ queryView, result })
            }
          }

          if (cancelled) {
            return
          }

          let totalReversed = 0
          let totalReordered = 0
          transaction(() => {
            for (const { queryView, result } of perLevel) {
              queryView.setDisplayedRegions(result.newRegions)
              totalReversed += result.stats.regionsReversed
              totalReordered += result.stats.regionsReordered
            }
          })

          setMessage(
            `Done: reordered ${totalReordered} regions, reversed ${totalReversed}`,
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
