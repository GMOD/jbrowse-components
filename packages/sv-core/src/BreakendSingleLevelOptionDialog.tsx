import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { useLocalStorage } from '@jbrowse/core/util'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import Checkbox2 from './Checkbox2'
import { navToSingleLevelBreak } from './navToSingleLevelBreak'

import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const BreakendSingleLevelOptionDialog = observer(
  function BreakendSingleLevelOptionDialog({
    session,
    handleClose,
    feature,
    stableViewId,
    assemblyName,
    view,
  }: {
    session: AbstractSessionModel
    handleClose: () => void
    stableViewId?: string
    feature: Feature
    view?: LinearGenomeViewModel
    assemblyName: string
  }) {
    const [copyTracks, setCopyTracks] = useState(true)
    const [focusOnBreakends, setFocusOnBreakends] = useState(true)
    const [windowSize, setWindowSize] = useLocalStorage(
      'breakpointWindowSize',
      '5000',
    )

    return (
      <Dialog
        open
        onClose={handleClose}
        title="Single-level breakpoint split view options"
      >
        <DialogContent>
          {view ? (
            <Checkbox2
              checked={copyTracks}
              label="Copy tracks into the new view"
              onChange={event => {
                setCopyTracks(event.target.checked)
              }}
            />
          ) : null}
          <Checkbox2
            checked={copyTracks}
            label="Focus on breakends"
            onChange={event => {
              setFocusOnBreakends(event.target.checked)
            }}
          />

          <TextField
            label="Window size (bp)"
            value={windowSize}
            onChange={event => {
              setWindowSize(event.target.value)
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              ;(async () => {
                try {
                  const { assemblyManager } = session
                  const assembly =
                    await assemblyManager.waitForAssembly(assemblyName)
                  if (!assembly) {
                    throw new Error(`assembly ${assemblyName} not found`)
                  }
                  await navToSingleLevelBreak({
                    feature,
                    assemblyName,
                    focusOnBreakends,
                    session,
                    stableViewId,
                    tracks: view?.tracks,
                    windowSize: +windowSize || 0,
                  })
                } catch (e) {
                  console.error(e)
                  session.notifyError(`${e}`, e)
                }
              })()
              handleClose()
            }}
            variant="contained"
            color="primary"
            autoFocus
          >
            OK
          </Button>
          <Button
            color="secondary"
            variant="contained"
            onClick={() => {
              handleClose()
            }}
          >
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    )
  },
)

export default BreakendSingleLevelOptionDialog
