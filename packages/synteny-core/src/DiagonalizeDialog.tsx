import { useState } from 'react'

import { Dialog, ErrorBanner, StatusProgressBar } from '@jbrowse/core/ui'
import {
  createStatusThrottle,
  statusFraction,
  statusProgressLabel,
} from '@jbrowse/core/util'
import { createStopToken, stopStopToken } from '@jbrowse/core/util/stopToken'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent, Typography } from '@mui/material'

import type {
  DiagonalizeRunOpts,
  DiagonalizeStats,
} from './diagonalizeTypes.ts'
import type { RpcStatus } from '@jbrowse/core/util'
import type { StopToken } from '@jbrowse/core/util/stopToken'

const useStyles = makeStyles()({
  content: {
    minWidth: 400,
  },
  progress: {
    marginTop: 16,
  },
})

// One state object rather than parallel isRunning/done/error/token flags: a run
// is either not started, in flight (and therefore cancellable), finished with a
// summary, or failed. Nothing else is representable, so no combination of
// booleans has to be reasoned about.
type RunState =
  | { phase: 'idle' }
  | { phase: 'running'; stopToken: StopToken; status: RpcStatus }
  | { phase: 'done'; summary: string }
  | { phase: 'failed'; error: unknown }

function summarize(stats: DiagonalizeStats | undefined) {
  return stats
    ? `Done: reordered ${stats.totalReordered} regions, reversed ${stats.totalReversed}`
    : 'No alignments to reorder'
}

/**
 * The manual "Re-order chromosomes" dialog shared by the linear synteny and
 * dotplot views: explains what the reorder does, runs it on demand with a
 * progress bar, and can abort it mid-flight. `run` is the view's own reorder
 * (the same function its auto-diagonalize path calls) and `description` the
 * view's wording for which axis/row moves.
 *
 * Deliberately explicit-start rather than run-on-mount: the reorder is an
 * expensive RPC that rewrites displayed regions, and starting on a click means
 * no effect is needed to kick it off.
 */
export default function DiagonalizeDialog({
  handleClose,
  description,
  run,
}: {
  handleClose: () => void
  description: string
  run: (opts: DiagonalizeRunOpts) => Promise<DiagonalizeStats | undefined>
}) {
  const { classes } = useStyles()
  const [state, setState] = useState<RunState>({ phase: 'idle' })

  async function start() {
    const stopToken = createStopToken()
    setState({ phase: 'running', stopToken, status: 'Preparing' })
    // One window per run, so the RPC's ~40/s download ticks don't drive a
    // React render each. Local to the run rather than a hook: its lifetime is
    // exactly this dialog run.
    const throttle = createStatusThrottle()
    try {
      const stats = await run({
        stopToken,
        // a status arriving after the run was cancelled or finished must not
        // resurrect the running phase
        statusCallback: status => {
          throttle.run(() => {
            setState(prev =>
              prev.phase === 'running' ? { ...prev, status } : prev,
            )
          })
        },
      })
      setState({ phase: 'done', summary: summarize(stats) })
    } catch (error) {
      console.error(error)
      setState({ phase: 'failed', error })
    }
  }

  return (
    <Dialog
      open
      title="Re-order chromosomes"
      // closing mid-run would leave the RPC running with nothing showing its
      // progress, so the only way out of a running dialog is Stop
      onClose={() => {
        if (state.phase !== 'running') {
          handleClose()
        }
      }}
    >
      <DialogContent className={classes.content}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {description}
        </Typography>
        {state.phase === 'running' ? (
          <>
            <Typography>{statusProgressLabel(state.status)}</Typography>
            <StatusProgressBar
              fraction={statusFraction(state.status)}
              className={classes.progress}
            />
          </>
        ) : null}
        {state.phase === 'done' ? (
          <Typography>{state.summary}</Typography>
        ) : null}
        {state.phase === 'failed' ? <ErrorBanner error={state.error} /> : null}
      </DialogContent>
      <DialogActions>
        {state.phase === 'running' ? (
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              stopStopToken(state.stopToken)
              handleClose()
            }}
          >
            Stop
          </Button>
        ) : (
          <>
            <Button
              variant="contained"
              color="secondary"
              onClick={() => {
                handleClose()
              }}
            >
              Close
            </Button>
            {state.phase === 'idle' ? (
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  start()
                }}
              >
                Start
              </Button>
            ) : null}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
