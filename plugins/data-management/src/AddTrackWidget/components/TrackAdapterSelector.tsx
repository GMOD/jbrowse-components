import { getEnv } from '@jbrowse/core/util'
import { UNKNOWN, getFileName } from '@jbrowse/core/util/tracks'
import { ListSubheader, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { alternativeAdapters, categorizeAdapters } from './util.ts'

import type { AddTrackModel } from '../model.ts'

const TrackAdapterSelector = observer(function ({
  model,
}: {
  model: AddTrackModel
}) {
  const { trackData, trackAdapter, adapterHint, adapterHintNotConfigurable } =
    model
  const { pluginManager } = getEnv(model)

  // Show the adapterHint if set (even if config couldn't be built),
  // otherwise show the resolved adapter type (blank for UNKNOWN)
  const resolvedType = trackAdapter?.type === UNKNOWN ? '' : trackAdapter?.type
  const displayValue = adapterHint || resolvedType || ''

  const adaptersList = pluginManager
    .getAdapterElements()
    .filter(e => !e.adapterMetadata?.hiddenFromGUI)
  // Other readings of this same file. The extension guess is first-match-wins,
  // so where two adapters read one extension the loser is reachable only by
  // knowing its name — see alternativeAdapters.
  const alternatives = alternativeAdapters({
    adaptersList,
    fileName: trackData ? getFileName(trackData) : undefined,
    chosenAdapterType: displayValue,
  })

  return (
    <TextField
      value={displayValue}
      label="Adapter type"
      variant="outlined"
      select
      fullWidth
      error={adapterHintNotConfigurable}
      // Stated on the field rather than only as a group inside the menu: the
      // whole problem is that nobody opens a dropdown they have no reason to
      // think holds a better answer.
      helperText={
        adapterHintNotConfigurable
          ? `The "${adapterHint}" adapter cannot be configured for the provided file. This adapter may require a specific file extension or additional setup.`
          : alternatives.length
            ? `This file can also be read as: ${alternatives.map(e => e.displayName).join(', ')}`
            : undefined
      }
      onChange={event => {
        model.setAdapterHint(event.target.value)
      }}
    >
      {[
        // Pulled to the top as their own group as well, so the line above is
        // actionable without hunting for the name in the full list.
        ...(alternatives.length
          ? [
              <ListSubheader key="__alsoReads">
                Also reads this file
              </ListSubheader>,
              alternatives.map(elt => (
                <MenuItem key={`__alsoReads-${elt.name}`} value={elt.name}>
                  {elt.displayName}
                </MenuItem>
              )),
            ]
          : []),
        ...Object.entries(categorizeAdapters(adaptersList)).map(
          ([key, val]) => [
            // returning array avoids needing to use a react fragment which
            // Select/TextField sub-elements disagree with
            <ListSubheader key={key}>{key}</ListSubheader>,
            val.map(elt => (
              <MenuItem key={elt.name} value={elt.name}>
                {elt.displayName}
              </MenuItem>
            )),
          ],
        ),
      ]}
    </TextField>
  )
})

export default TrackAdapterSelector
