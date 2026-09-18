import { useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { assembleLocStrings } from '@jbrowse/core/util'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model.ts'
import type { BpOffset } from '../types.ts'

/**
 * The one thing a detail level still needs deciding once a drag has named its
 * span: whether it opens showing what this view shows, or empty for a track
 * chosen afterwards.
 *
 * The span is the selection's, named here the way the same menu's "Copy range"
 * names it, so the dialog says what it is about to open rather than describing
 * the feature. The model's action takes the same two offsets, for a stack an
 * agent or a spec builds outright.
 */
const AddDetailLevelDialog = observer(function AddDetailLevelDialog({
  model,
  leftOffset,
  rightOffset,
  handleClose,
}: {
  model: LinearGenomeViewModel
  leftOffset?: BpOffset
  rightOffset?: BpOffset
  handleClose: () => void
}) {
  const [copyTracks, setCopyTracks] = useState(true)
  const rangeString = assembleLocStrings(
    model.getSelectedRegions(leftOffset, rightOffset),
  )

  return (
    <SubmitDialog
      open
      maxWidth="xs"
      fullWidth
      title="Add detail level"
      onCancel={handleClose}
      submitText="Add"
      onSubmit={() => {
        model.addDetailLevelForSpan(leftOffset, rightOffset, {
          trackIds: copyTracks ? undefined : [],
        })
        handleClose()
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Typography>
          A closer view of {rangeString}, below the tracks. It stays centred on
          this view, which moves to the middle of that span.
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
