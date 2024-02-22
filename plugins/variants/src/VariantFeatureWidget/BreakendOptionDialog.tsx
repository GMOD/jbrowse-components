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
import { Dialog } from '@jbrowse/core/ui'
import { getSession, Feature } from '@jbrowse/core/util'
import { ViewType } from '@jbrowse/core/pluggableElementTypes'
// locals
import { VariantFeatureWidgetModel } from './stateModelFactory'

const useStyles = makeStyles()({
  block: {
    display: 'block',
  },
})

interface Track {
  id: string
  displays: { id: string; [key: string]: unknown }[]
  [key: string]: unknown
}

function stripIds(arr: Track[]) {
  return arr.map(({ id, displays, ...rest }) => ({
    ...rest,
    displays: displays.map(({ id, ...rest }) => rest),
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
  feature,
  viewType,
}: {
  model: VariantFeatureWidgetModel
  handleClose: () => void
  feature: Feature
  viewType: ViewType
}) {
  const [copyTracks, setCopyTracks] = useState(true)
  const [mirror, setMirror] = useState(true)

  return (
    <Dialog open onClose={handleClose} title="Breakpoint split view options">
      <DialogContent>
        <Checkbox2
          checked={copyTracks}
          onChange={event => setCopyTracks(event.target.checked)}
          label="Copy tracks into the new view"
        />
        <Checkbox2
          checked={mirror}
          onChange={event => setMirror(event.target.checked)}
          label="Mirror tracks vertically in vertically stacked view"
        />
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            const { view } = model
            const session = getSession(model)
            try {
              // @ts-expect-error
              const viewSnapshot = viewType.snapshotFromBreakendFeature(
                feature,
                view,
              )
              const [view1, view2] = viewSnapshot.views
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
              const viewTracks = getSnapshot(view.tracks) as Track[]

              session.addView('BreakpointSplitView', {
                ...viewSnapshot,
                views: [
                  {
                    ...view1,
                    tracks: stripIds(viewTracks),
                    offsetPx: view1.offsetPx - view.width / 2 + 100,
                  },
                  {
                    ...view2,
                    tracks: stripIds(
                      mirror ? [...viewTracks].reverse() : viewTracks,
                    ),
                    offsetPx: view2.offsetPx - view.width / 2 + 100,
                  },
                ],
              })
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
