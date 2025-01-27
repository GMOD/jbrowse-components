import { getEnv } from '@jbrowse/core/util'
import { ListSubheader, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { categorizeAdapters } from './util'

import type { AddTrackModel } from '../model'

const TrackAdapterSelector = observer(({ model }: { model: AddTrackModel }) => {
  const { trackAdapter } = model
  const { pluginManager } = getEnv(model)

  return (
    <TextField
      value={trackAdapter?.type !== 'UNKNOWN' ? trackAdapter?.type : ''}
      label="Adapter type"
      variant="outlined"
      select
      fullWidth
      onChange={event => {
        model.setAdapterHint(event.target.value)
      }}
      slotProps={{
        select: {
          SelectDisplayProps: {
            // @ts-expect-error
            'data-testid': 'adapterTypeSelect',
          },
        },
      }}
    >
      {Object.entries(
        categorizeAdapters(
          pluginManager
            .getAdapterElements()
            .filter(e => !e.adapterMetadata?.hiddenFromGUI),
        ),
      ).map(([key, val]) => [
        // returning array avoids needing to use a react fragment which
        // Select/TextField sub-elements disagree with
        <ListSubheader key={key}>{key}</ListSubheader>,
        val.map(elt => (
          <MenuItem key={elt.name} value={elt.name}>
            {elt.displayName}
          </MenuItem>
        )),
      ])}
    </TextField>
  )
})

export default TrackAdapterSelector
