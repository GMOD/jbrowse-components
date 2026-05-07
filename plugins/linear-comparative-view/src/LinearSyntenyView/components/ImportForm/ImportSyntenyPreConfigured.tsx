import { useEffect, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { MenuItem, Paper, Select, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

const ImportSyntenyTrackSelector = observer(
  function ImportSyntenyTrackSelector({
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
    const filteredTracks = session.tracks.filter(track => {
      const assemblyNames = readConfObject(track, 'assemblyNames')
      return (
        assemblyNames.includes(assembly1) &&
        assemblyNames.includes(assembly2) &&
        track.type.includes('Synteny')
      )
    })
    const resetTrack = filteredTracks[0]?.trackId ?? ''
    const [value, setValue] = useState(resetTrack)
    useEffect(() => {
      model.setImportFormSyntenyTrack(selectedRow, {
        type: 'preConfigured',
        value: resetTrack,
      })
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
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
              const v = event.target.value
              setValue(v)
              model.setImportFormSyntenyTrack(selectedRow, {
                type: 'preConfigured',
                value: v,
              })
            }}
          >
            {filteredTracks.map(track => (
              <MenuItem key={track.trackId} value={track.trackId}>
                {getTrackName(track, session)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <ErrorBanner
            error={`No synteny tracks found for ${assembly1},${assembly2}`}
          />
        )}
      </Paper>
    )
  },
)

export default ImportSyntenyTrackSelector
