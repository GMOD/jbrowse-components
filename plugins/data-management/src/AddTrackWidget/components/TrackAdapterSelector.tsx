import React from 'react'
import { getEnv } from '@jbrowse/core/util'
import { ListSubheader, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { AddTrackModel } from '../model'
import type AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

// locals

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

// collate adapters into a map with
// key: category
// value: array of adapters with that category
function categorizeAdapters(adaptersList: AdapterType[]) {
  const map = {} as Record<string, AdapterType[]>
  adaptersList.forEach(adapter => {
    const key = adapter.adapterMetadata?.category || 'Default'
    if (!map[key]) {
      map[key] = []
    }
    map[key].push(adapter)
  })
  return map
}

const TrackAdapterSelector = observer(({ model }: { model: AddTrackModel }) => {
  const { classes } = useStyles()
  const { trackAdapter } = model
  const { pluginManager } = getEnv(model)
  return (
    <TextField
      className={classes.spacing}
      value={trackAdapter?.type !== 'UNKNOWN' ? trackAdapter?.type : ''}
      label="Adapter type"
      variant="outlined"
      helperText="Select an adapter type"
      select
      fullWidth
      onChange={event => {
        model.setAdapterHint(event.target.value)
      }}
      slotProps={{
        select: {
          // @ts-expect-error
          SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
        },
      }}
    >
      {Object.entries(
        categorizeAdapters(
          pluginManager
            .getAdapterElements()
            .filter(e => !e.adapterMetadata?.hiddenFromGUI),
        ),
      ).map(([key, val]) => {
        // returning array avoids needing to use a react fragment which
        // Select/TextField sub-elements disagree with
        return [
          <ListSubheader key={key}>{key}</ListSubheader>,
          val.map(elt => (
            <MenuItem key={elt.name} value={elt.name}>
              {elt.displayName}
            </MenuItem>
          )),
        ]
      })}
    </TextField>
  )
})

export default TrackAdapterSelector
