import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { SubmitDialog } from '@jbrowse/core/ui'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model.ts'

/**
 * The one thing a detail level needs deciding: whether it opens showing what
 * this view shows, or empty for a track chosen afterwards.
 *
 * It asks for no span and no side. The level arrives a tenth as wide as the
 * closest one there is, under the tracks, and the wheel takes it from there —
 * a gesture over the picture rather than a number nobody brings to a dialog.
 * The model's action still takes `windowWidthBp` and a track list, for a stack
 * a spec or an agent builds outright.
 *
 * The track list this used to carry was the hierarchical selector in
 * miniature, duplicated down to the filter box, for a choice the level's own
 * track selector already makes better a moment later.
 */
const AddDetailLevelDialog = observer(function AddDetailLevelDialog({
  model,
  handleClose,
}: {
  model: LinearGenomeViewModel
  handleClose: () => void
}) {
  const [copyTracks, setCopyTracks] = useState(true)

  return (
    <SubmitDialog
      open
      maxWidth="xs"
      fullWidth
      title="Add detail level"
      onCancel={handleClose}
      submitText="Add"
      onSubmit={() => {
        model.addDetailLevel({
          trackIds: copyTracks
            ? model.tracks.map(
                track =>
                  readConfObject(track.configuration, 'trackId') as string,
              )
            : [],
        })
        handleClose()
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Typography>
          A closer view of this locus below the tracks, ten times zoomed in. It
          stays centred on this view, and zooming it changes its span alone.
        </Typography>
        <FormControlLabel
          label="Copy this view's tracks"
          control={
            <Checkbox
              size="small"
              checked={copyTracks}
              data-testid="detail-level-copy-tracks"
              onChange={event => {
                setCopyTracks(event.target.checked)
              }}
            />
          }
        />
      </div>
    </SubmitDialog>
  )
})

export default AddDetailLevelDialog
