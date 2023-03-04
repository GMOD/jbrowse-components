import React from 'react'
import { ListSubheader, MenuItem, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'
import AdapterType from '@jbrowse/core/pluggableElementTypes/AdapterType'

// locals
import { AddTrackModel } from '../model'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

// collate adapters into a map with
// key: category
// value: array of adapters with that category
function categorizeAdapters(adaptersList: AdapterType[]) {
  const map = {} as { [key: string]: AdapterType[] }
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
      onChange={event => model.setAdapterHint(event.target.value)}
      SelectProps={{
        // @ts-expect-error
        SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
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
          <ListSubheader>{key}</ListSubheader>,
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
