import { useEffect } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorMessage } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { MenuItem, Paper, Select, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ImportSyntenyTrackSelector = observer(function ({
  model,
  selectedRow,
  assembly1,
  assembly2,
}: {
  model: LinearSyntenyViewModel
  selectedRow: number
  assembly1: string
  assembly2: string
}) {
  const session = getSession(model)
  const { preConfiguredSyntenyTracksToShow } = model
  const { tracks = [], sessionTracks = [] } = session
  const allTracks = [...tracks, ...sessionTracks] as AnyConfigurationModel[]
  const filteredTracks = allTracks.filter(track => {
    const assemblyNames = readConfObject(track, 'assemblyNames')
    return (
      assemblyNames.includes(assembly1) &&
      assemblyNames.includes(assembly2) &&
      track.type.includes('Synteny')
    )
  })
  const resetTrack = filteredTracks[0]?.trackId || ''
  const value = preConfiguredSyntenyTracksToShow[selectedRow]
  useEffect(() => {
    model.setPreConfiguredSyntenyTrack(selectedRow, resetTrack)
  }, [assembly2, assembly1, resetTrack, selectedRow, model])
  return (
    <Paper style={{ padding: 12 }}>
      <Typography>
        Select a track from the select box below, the track will be shown when
        you hit "Launch".
      </Typography>

      {value && filteredTracks.map(r => r.trackId).includes(value) ? (
        <Select
          value={value}
          onChange={event => {
            model.setPreConfiguredSyntenyTrack(selectedRow, event.target.value)
          }}
        >
          {filteredTracks.map(track => (
            <MenuItem key={track.trackId} value={track.trackId}>
              {getTrackName(track, session)}
            </MenuItem>
          ))}
        </Select>
      ) : (
        <ErrorMessage
          error={`No synteny tracks found for ${assembly1},${assembly2}`}
        />
      )}
    </Paper>
  )
})

export default ImportSyntenyTrackSelector
