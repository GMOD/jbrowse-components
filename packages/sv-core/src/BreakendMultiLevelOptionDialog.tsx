import { useState } from 'react'

import { Dialog } from '@jbrowse/core/ui'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import Checkbox2 from './Checkbox2'
import { navToMultiLevelBreak } from './navToMultiLevelBreak'

import type { Track } from './types'
import type { AbstractSessionModel, Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const BreakendMultiLevelOptionDialog = observer(
  function BreakendMultiLevelOptionDialog({
    session,
    handleClose,
    feature,
    assemblyName,
    stableViewId,
    view,
  }: {
    session: AbstractSessionModel
    handleClose: () => void
    feature: Feature
    view?: LinearGenomeViewModel
    assemblyName: string
    stableViewId?: string
  }) {
    const [copyTracks, setCopyTracks] = useState(true)
    const [mirror, setMirror] = useState(true)

    return (
      <Dialog
        open
        onClose={handleClose}
        title="Multi-level breakpoint split view options"
      >
        <DialogContent>
          <div>Launch multi-level breakpoint split view</div>
          {view ? (
            <>
              <Checkbox2
                checked={copyTracks}
                label="Copy tracks into the new view"
                onChange={event => {
                  setCopyTracks(event.target.checked)
                }}
              />

              {copyTracks ? (
                <Checkbox2
                  checked={mirror}
                  disabled={!copyTracks}
                  label="Mirror the copied tracks (only available if copying tracks and using two level)"
                  onChange={event => {
                    setMirror(event.target.checked)
                  }}
                />
              ) : null}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
              ;(async () => {
                try {
                  await navToMultiLevelBreak({
                    stableViewId,
                    session,
                    tracks:
                      copyTracks && view
                        ? (getSnapshot(view.tracks) as Track[])
                        : [],
                    mirror,
                    feature,
                    assemblyName,
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

export default BreakendMultiLevelOptionDialog
