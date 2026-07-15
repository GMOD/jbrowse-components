import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { collapseIntrons, replaceIntrons, runIntronAction } from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The "Replace current view" / "Open in new view" pair, shared by the dialog
// footer (acting on all transcripts) and each transcript table row. When
// `soloFeatureId` is set the resulting view's track (found by `trackId`) is
// isolated to that feature.
const IntronActionButtons = observer(function IntronActionButtons({
  view,
  transcripts,
  assembly,
  windowSize,
  flip,
  canLaunchView,
  handleClose,
  trackId,
  soloFeatureId,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  windowSize: number | undefined
  flip: boolean
  canLaunchView: boolean
  handleClose: () => void
  trackId: string
  soloFeatureId: string | undefined
}) {
  // undefined while the window-size field is invalid; both buttons disable and
  // the click handlers no-op, so neither action runs with a bad padding.
  const args =
    windowSize === undefined
      ? undefined
      : {
          view,
          transcripts,
          assembly,
          padding: windowSize,
          flip,
          trackId,
          soloFeatureId,
        }
  const run = (
    action: (a: NonNullable<typeof args>) => void | Promise<void>,
  ) => {
    if (args) {
      void runIntronAction(view, () => action(args), handleClose)
    }
  }
  return (
    <>
      <Button
        size="small"
        variant="contained"
        color="primary"
        disabled={args === undefined}
        onClick={() => {
          run(replaceIntrons)
        }}
      >
        Replace current view
      </Button>
      {canLaunchView ? (
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={args === undefined}
          onClick={() => {
            run(collapseIntrons)
          }}
        >
          Open in new view
        </Button>
      ) : null}
    </>
  )
})

export default IntronActionButtons
