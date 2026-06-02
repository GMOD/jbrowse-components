import { useState } from 'react'

import { ErrorBanner, SubmitDialog } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { MenuItem, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getAddRowOptions } from '../util/syntenyTracks.ts'

import type { LinearComparativeViewModel } from '../../LinearComparativeView/model.ts'

const AddRowDialog = observer(function AddRowDialog({
  model,
  handleClose,
}: {
  model: LinearComparativeViewModel
  handleClose: () => void
}) {
  const session = getSession(model)
  const terminalAssembly =
    model.views[model.views.length - 1]?.assemblyNames[0] ?? ''
  const options = getAddRowOptions(session, terminalAssembly)

  const [trackId, setTrackId] = useState(options[0]?.trackId ?? '')
  const selected = options.find(o => o.trackId === trackId)

  return (
    <SubmitDialog
      open
      title="Add assembly row"
      onCancel={handleClose}
      submitText="Add"
      submitDisabled={!selected}
      onSubmit={() => {
        if (selected) {
          model.appendRow({
            assembly: selected.newAssembly,
            syntenyTrackId: selected.trackId,
          })
          handleClose()
        }
      }}
    >
      <Typography gutterBottom>
        Pick a synteny dataset connecting <b>{terminalAssembly}</b> to a new
        assembly. The assembly is added as a new row at the bottom of the view.
      </Typography>
      {options.length ? (
        <TextField
          select
          fullWidth
          label="Synteny dataset"
          value={trackId}
          onChange={event => {
            setTrackId(event.target.value)
          }}
        >
          {options.map(o => (
            <MenuItem key={o.trackId} value={o.trackId}>
              {o.name} → {o.newAssembly}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <ErrorBanner
          error={`No synteny tracks found connecting to ${terminalAssembly}. Synteny datasets pair two assemblies, so a new row can only be added if a dataset references the current bottom assembly.`}
        />
      )}
    </SubmitDialog>
  )
})

export default AddRowDialog
