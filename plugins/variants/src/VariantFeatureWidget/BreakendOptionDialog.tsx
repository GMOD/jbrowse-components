/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react'
import { observer } from 'mobx-react'
import {
  Button,
  Checkbox,
  DialogActions,
  DialogContent,
  FormControlLabel,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getSnapshot } from 'mobx-state-tree'
// jbrowse
import { Dialog } from '@jbrowse/core/ui'
import { getSession, Feature } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  block: {
    display: 'block',
  },
})

function BreakendOptionDialog({
  model,
  handleClose,
  feature,
  viewType,
}: {
  model: any
  handleClose: () => void
  feature: Feature
  viewType: any
}) {
  const { classes } = useStyles()
  const [copyTracks, setCopyTracks] = useState(true)
  const [mirrorTracks, setMirrorTracks] = useState(true)

  return (
    <Dialog open onClose={handleClose} title="Breakpoint split view options">
      <DialogContent>
        <FormControlLabel
          className={classes.block}
          control={
            <Checkbox
              checked={copyTracks}
              onChange={() => setCopyTracks(val => !val)}
            />
          }
          label="Copy tracks into the new view"
        />

        <FormControlLabel
          className={classes.block}
          control={
            <Checkbox
              checked={mirrorTracks}
              onChange={() => setMirrorTracks(val => !val)}
            />
          }
          label="Mirror tracks vertically in vertically stacked view"
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const { view } = model
            const session = getSession(model)
            try {
              const viewSnapshot = viewType.snapshotFromBreakendFeature(
                feature,
                view,
              )

              interface Track {
                trackId: string
                [key: string]: unknown
              }
              function remapIds(arr: Track[]) {
                return arr.map(v => ({
                  ...v,
                  id: `${v.trackId}-${Math.random()}`,
                }))
              }
              viewSnapshot.views[0].offsetPx -= view.width / 2 + 100
              viewSnapshot.views[1].offsetPx -= view.width / 2 + 100
              viewSnapshot.featureData = feature
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
              const viewTracks = getSnapshot(view.tracks) as Track[]
              viewSnapshot.views[0].tracks = remapIds(viewTracks)
              viewSnapshot.views[1].tracks = remapIds(
                mirrorTracks ? [...viewTracks].reverse() : viewTracks,
              )

              session.addView('BreakpointSplitView', viewSnapshot)
            } catch (e) {
              console.error(e)
              session.notify(`${e}`)
            }
            handleClose()
          }}
          variant="contained"
          color="primary"
          autoFocus
        >
          OK
        </Button>
        <Button
          onClick={() => handleClose()}
          color="secondary"
          variant="contained"
        >
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  )
}
export default observer(BreakendOptionDialog)
