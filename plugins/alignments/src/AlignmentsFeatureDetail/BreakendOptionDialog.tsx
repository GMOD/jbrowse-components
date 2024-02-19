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
import { getSession } from '@jbrowse/core/util'
import { Dialog } from '@jbrowse/core/ui'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'

// locals
import { AlignmentFeatureWidgetModel } from './stateModelFactory'
import { getBreakpointSplitView } from './launchBreakpointSplitView'
import { getSnapshot } from 'mobx-state-tree'
import { ReducedFeature } from './getSAFeatures'

const useStyles = makeStyles()({
  block: {
    display: 'block',
  },
})

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

function Checkbox2({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  const { classes } = useStyles()
  return (
    <FormControlLabel
      className={classes.block}
      control={<Checkbox checked={checked} onChange={onChange} />}
      label={label}
    />
  )
}

const BreakendOptionDialog = observer(function ({
  model,
  handleClose,
  f1,
  f2,
}: {
  model: AlignmentFeatureWidgetModel
  handleClose: () => void
  f1: ReducedFeature
  f2: ReducedFeature
  viewType: ViewType
}) {
  const [copyTracks, setCopyTracks] = useState(true)
  const [mirrorTracks, setMirrorTracks] = useState(true)

  return (
    <Dialog open onClose={handleClose} title="Breakpoint split view options">
      <DialogContent>
        <Checkbox2
          checked={copyTracks}
          onChange={event => setCopyTracks(event.target.checked)}
          label="Copy tracks into the new view"
        />
        <Checkbox2
          checked={mirrorTracks}
          onChange={event => setMirrorTracks(event.target.checked)}
          label="Mirror tracks vertically in vertically stacked view"
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const { view } = model
            const session = getSession(model)
            try {
              const viewSnapshot = getBreakpointSplitView({ view, f1, f2 })
              viewSnapshot.views[0].offsetPx -= view.width / 2 + 100
              viewSnapshot.views[1].offsetPx -= view.width / 2 + 100
              // viewSnapshot.featureData = feature
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
})

export default BreakendOptionDialog
