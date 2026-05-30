import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSyntenyTracks, pickSyntenyTrackId } from '@jbrowse/synteny-core'
import { MenuItem, Paper, Select, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

const ImportSyntenyTrackSelector = observer(
  function ImportSyntenyTrackSelector({
    model,
    assembly1,
    assembly2,
    selectedRow,
  }: {
    model: LinearSyntenyViewModel
    assembly1: string
    assembly2: string
    selectedRow: number
  }) {
    const session = getSession(model)
    const filteredTracks = getSyntenyTracks(session.tracks, [
      assembly1,
      assembly2,
    ])
    const selection = model.importFormSyntenyTrackSelections[selectedRow]
    const picked = selection?.type === 'preConfigured' ? selection.value : ''
    const value = pickSyntenyTrackId(picked, filteredTracks) ?? ''
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
              model.setImportFormSyntenyTrack(selectedRow, {
                type: 'preConfigured',
                value: event.target.value,
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
