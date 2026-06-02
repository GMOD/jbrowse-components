import { getEnv } from '@jbrowse/core/util'
import { ListSubheader, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { categorizeAdapters } from './util.ts'

import type { AddTrackModel } from '../model.ts'

const TrackAdapterSelector = observer(function ({
  model,
}: {
  model: AddTrackModel
}) {
  const { trackAdapter, adapterHint, adapterHintNotConfigurable } = model
  const { pluginManager } = getEnv(model)

  // Show the adapterHint if set (even if config couldn't be built),
  // otherwise show the resolved adapter type (blank for UNKNOWN)
  const resolvedType =
    trackAdapter?.type === 'UNKNOWN' ? '' : trackAdapter?.type
  const displayValue = adapterHint || resolvedType || ''

  return (
    <TextField
      value={displayValue}
      label="Adapter type"
      variant="outlined"
      select
      fullWidth
      error={adapterHintNotConfigurable}
      helperText={
        adapterHintNotConfigurable
          ? `The "${adapterHint}" adapter cannot be configured for the provided file. This adapter may require a specific file extension or additional setup.`
          : undefined
      }
      onChange={event => {
        model.setAdapterHint(event.target.value)
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
