import { ErrorBanner } from '@jbrowse/core/ui'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { MenuItem, Paper, Select, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { DotplotViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ImportSyntenyTrackSelector = observer(
  function ImportSyntenyTrackSelector({
    model,
    assemblyX,
    assemblyY,
    syntenyTracks,
    value,
    setValue,
  }: {
    model: DotplotViewModel
    assemblyX: string
    assemblyY: string
    syntenyTracks: AnyConfigurationModel[]
    value: string
    setValue: (arg: string) => void
  }) {
    const session = getSession(model)
    return (
      <Paper style={{ padding: 12 }}>
        <Typography>
          Select a track from the select box below, the track will be shown when
          you hit "Launch". Note: there is a track selector <i>inside</i> the
          DotplotView, which can turn on one or more SyntenyTracks (more than
          one can be displayed at once). Look for the track selector icon{' '}
          <TrackSelectorIcon />
        </Typography>
        {syntenyTracks.length ? (
          <Select
            value={value || syntenyTracks[0]!.trackId}
            onChange={event => {
              setValue(event.target.value)
            }}
          >
            {syntenyTracks.map(track => (
              <MenuItem key={track.trackId} value={track.trackId}>
                {getTrackName(track, session)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <ErrorBanner
            error={`No synteny tracks found for ${assemblyX},${assemblyY}`}
          />
        )}
      </Paper>
    )
  },
)

export default ImportSyntenyTrackSelector
