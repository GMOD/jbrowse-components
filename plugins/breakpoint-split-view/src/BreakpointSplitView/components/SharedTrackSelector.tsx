import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { getSharedTracks } from './importFormUtils.ts'

import type { BreakpointViewModel } from '../model.ts'

const SharedTrackSelector = observer(function SharedTrackSelector({
  model,
  assemblies,
  value,
  onChange,
}: {
  model: BreakpointViewModel
  assemblies: string[]
  value: string
  onChange: (trackId: string) => void
}) {
  const session = getSession(model)
  const sharedTracks = getSharedTracks(session.tracks, assemblies)

  return (
    <TextField
      select
      label="Track to open in all rows (optional)"
      value={value}
      onChange={event => {
        onChange(event.target.value)
      }}
      style={{ minWidth: 300 }}
    >
      <MenuItem value="">(none)</MenuItem>
      {sharedTracks.map(track => (
        <MenuItem key={track.trackId} value={track.trackId}>
          {getTrackName(track, session)}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default SharedTrackSelector
