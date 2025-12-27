import { getEnv } from '@jbrowse/core/util'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { AddTrackModel } from '../model'

const TrackTypeSelector = observer(function TrackTypeSelector({
  model,
}: {
  model: AddTrackModel
}) {
  const { pluginManager } = getEnv(model)
  const { trackType } = model
  const trackTypes = pluginManager.getTrackElements()

  return (
    <TextField
      value={trackType}
      variant="outlined"
      label="Track type"
      select
      fullWidth
      onChange={event => {
        model.setTrackType(event.target.value)
      }}
      slotProps={{
        select: {
          SelectDisplayProps: {
            // @ts-expect-error
            'data-testid': 'trackTypeSelect',
          },
        },
      }}
    >
      {trackTypes.map(({ name, displayName }) => (
        <MenuItem key={name} value={name}>
          {displayName}
        </MenuItem>
      ))}
    </TextField>
  )
})

export default TrackTypeSelector
