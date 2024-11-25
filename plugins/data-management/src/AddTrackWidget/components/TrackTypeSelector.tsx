import React from 'react'
import { getEnv } from '@jbrowse/core/util'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { AddTrackModel } from '../model'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

const TrackTypeSelector = observer(({ model }: { model: AddTrackModel }) => {
  const { classes } = useStyles()
  const { pluginManager } = getEnv(model)
  const { trackType } = model
  const trackTypes = pluginManager.getTrackElements()

  return (
    <TextField
      className={classes.spacing}
      value={trackType}
      variant="outlined"
      label="Track type"
      helperText="Select track type"
      select
      fullWidth
      onChange={event => {
        model.setTrackType(event.target.value)
      }}
      slotProps={{
        select: {
          // @ts-expect-error
          SelectDisplayProps: { 'data-testid': 'trackTypeSelect' },
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
