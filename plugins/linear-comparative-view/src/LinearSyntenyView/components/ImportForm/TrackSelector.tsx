import React, { useState, useEffect } from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorMessage } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { Select, MenuItem, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import type { LinearSyntenyViewModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

const ImportSyntenyTrackSelector = observer(function ({
  model,
  assembly1,
  assembly2,
  preConfiguredSyntenyTrack,
  setPreConfiguredSyntenyTrack,
}: {
  model: LinearSyntenyViewModel
  assembly1: string
  assembly2: string
  preConfiguredSyntenyTrack: string | undefined
  setPreConfiguredSyntenyTrack: (arg: string) => void
}) {
  const session = getSession(model)
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
  const [value, setValue] = useState(resetTrack)

  useEffect(() => {
    // sets track data in a useEffect because the initial load is needed as
    // well as onChange's to the select box
    if (value !== preConfiguredSyntenyTrack) {
      setPreConfiguredSyntenyTrack(value)
    }
  }, [value, preConfiguredSyntenyTrack, setPreConfiguredSyntenyTrack])
  return (
    <Paper style={{ padding: 12 }}>
      <Typography>
        Select a track from the select box below, the track will be shown when
        you hit "Launch".
      </Typography>

      {filteredTracks.length ? (
        <Select
          value={value}
          onChange={event => {
            setValue(event.target.value)
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
