import { getTrackName } from '@jbrowse/core/util/tracks'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const SharedTrackSelector = observer(function SharedTrackSelector({
  session,
  tracks,
  value,
  onChange,
}: {
  session: AbstractSessionModel
  tracks: AnyConfigurationModel[]
  value: string
  onChange: (trackId: string) => void
}) {
  return (
    <TextField
      select
      variant="outlined"
      label="Track to open in all rows (optional)"
      value={value}
      onChange={event => {
        onChange(event.target.value)
      }}
      style={{ minWidth: 300 }}
    >
      <MenuItem value="">(none)</MenuItem>
      {tracks.map(track => (
        <MenuItem key={track.trackId} value={track.trackId}>
          {getTrackName(track, session)}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default SharedTrackSelector
