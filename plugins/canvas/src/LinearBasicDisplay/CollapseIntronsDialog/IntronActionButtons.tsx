import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import { collapseIntrons, replaceIntrons, runIntronAction } from './util.ts'

import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The "Replace current view" / "Open in new view" pair, shared by the dialog
// footer (acting on all transcripts) and each transcript table row.
const IntronActionButtons = observer(function IntronActionButtons({
  view,
  transcripts,
  assembly,
  windowSize,
  flip,
  canLaunchView,
  handleClose,
}: {
  view: LinearGenomeViewModel
  transcripts: Feature[]
  assembly: Assembly
  windowSize: number | undefined
  flip: boolean
  canLaunchView: boolean
  handleClose: () => void
}) {
  const disabled = windowSize === undefined
  return (
    <>
      <Button
        size="small"
        variant="contained"
        color="primary"
        disabled={disabled}
        onClick={() => {
          if (windowSize !== undefined) {
            void runIntronAction(
              view,
              () => {
                replaceIntrons({
                  view,
                  transcripts,
                  assembly,
                  padding: windowSize,
                  flip,
                })
              },
              handleClose,
            )
          }
        }}
      >
        Replace current view
      </Button>
      {canLaunchView ? (
        <Button
          size="small"
          variant="contained"
          color="primary"
          disabled={disabled}
          onClick={() => {
            if (windowSize !== undefined) {
              void runIntronAction(
                view,
                () =>
                  collapseIntrons({
                    view,
                    transcripts,
                    assembly,
                    padding: windowSize,
                    flip,
                  }),
                handleClose,
              )
            }
          }}
        >
          Open in new view
        </Button>
      ) : null}
    </>
  )
})

export default IntronActionButtons
