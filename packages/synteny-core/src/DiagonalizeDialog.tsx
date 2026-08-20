import { useRef, useState } from 'react'

import { Dialog, ErrorBanner, StatusProgressBar } from '@jbrowse/core/ui'
import {
  createStatusWindow,
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
  | { phase: 'running'; stopToken: StopToken; status: RpcStatus | undefined }
  | { phase: 'done'; summary: string }
  | { phase: 'failed'; error: unknown }

const EMPTY_STATS: DiagonalizeStats = { totalReordered: 0, totalReversed: 0 }

function summarize(stats: DiagonalizeStats | undefined) {
  return stats
    ? `Done: reordered ${stats.totalReordered} regions, reversed ${stats.totalReversed}`
    : 'No alignments to reorder'
}

// A stop is not an undo. The synteny cascade commits each level before running
// the next, so whatever it had already applied is still applied — and closing
// on that silently left a stack half-reordered with nothing saying so.
function summarizeStopped({ totalReordered, totalReversed }: DiagonalizeStats) {
  return totalReordered || totalReversed
    ? `Stopped after reordering ${totalReordered} regions, reversed ${totalReversed}. The rows below that were not reached — re-run to finish.`
    : 'Stopped. Nothing had been reordered yet.'
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

  // What the run has committed, and whether the user asked it to stop. A ref
  // rather than state: nothing renders either mid-flight, they only have to
  // survive until the run settles — and the stop flag has to be readable from
  // the callbacks without re-entering render.
  const runRef = useRef({ stopped: false, applied: EMPTY_STATS })

  async function start() {
    const stopToken = createStopToken()
    runRef.current = { stopped: false, applied: EMPTY_STATS }
    setState({ phase: 'running', stopToken, status: 'Preparing' })
    // One window per run, so the RPC's ~40/s download ticks don't drive a
    // React render each. Local to the run rather than a hook: its lifetime is
    // exactly this dialog run.
    const statusWindow = createStatusWindow()
    try {
      const stats = await run({
        stopToken,
        onProgress: applied => {
          runRef.current.applied = applied
        },
        // a status arriving after the run was cancelled or finished must not
        // resurrect the running phase, or talk over "Stopping" — and
        // the window's own sink rather than a hand-written check ahead of it,
        // because only that re-reads the guard INSIDE the throttled body. A
        // write queued while the run was live fires on a timer, by which point
        // Stop may have been pressed: the outer read said "not stopped" when the
        // write was queued, and the label it restored was the one "Stopping" had
        // just replaced.
        statusCallback: statusWindow.open({
          isCurrent: () => !runRef.current.stopped,
          write: status => {
            setState(prev =>
              prev.phase === 'running' ? { ...prev, status } : prev,
            )
          },
        }).statusCallback,
      })
      setState({ phase: 'done', summary: summarize(stats) })
    } catch (error) {
      // A stop surfaces here as the abort rejecting out of the runner, which is
      // not a failure to report — but everything the cascade had already
      // committed still stands, so it reports that instead of vanishing.
      if (runRef.current.stopped) {
        setState({
          phase: 'done',
          summary: summarizeStopped(runRef.current.applied),
        })
      } else {
        console.error(error)
        setState({ phase: 'failed', error })
      }
    } finally {
      // the Stop button covers only the cancelled run; a run that finished or
      // failed owns a token nobody else will ever stop, and an unstopped string
      // token retains a blob URL and every AbortController taken against it
      stopStopToken(stopToken)
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
            disabled={state.status === 'Stopping'}
            onClick={() => {
              // stays open rather than closing: the cascade commits level by
              // level, so the run has to settle and say what it left applied
              runRef.current.stopped = true
              stopStopToken(state.stopToken)
              setState(prev =>
                prev.phase === 'running'
                  ? { ...prev, status: 'Stopping' }
                  : prev,
              )
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
            {/* A reorder is a long RPC over remote alignment files, so it
            fails for reasons that have nothing to do with the request — and
            the only way back to Start was to close the dialog and pick the
            menu item again. 'done' keeps the single Close: the reorder it just
            reported is the state of the view, and a second identical pass over
            it is work with nothing to find. */}
            {state.phase === 'idle' || state.phase === 'failed' ? (
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  // eslint-disable-next-line @typescript-eslint/no-floating-promises
                  start()
                }}
              >
                {state.phase === 'failed' ? 'Retry' : 'Start'}
              </Button>
            ) : null}
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
