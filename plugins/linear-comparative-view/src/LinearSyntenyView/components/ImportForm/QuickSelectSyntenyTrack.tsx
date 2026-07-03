import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSyntenyTracks } from '@jbrowse/synteny-core'
import { MenuItem, Select, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

// Auto-fill both row assemblies from an existing synteny track's assemblyNames,
// so a user with a pre-configured PAF/chain track can launch it without first
// guessing which two assemblies it connects. Passing [] to getSyntenyTracks
// returns every synteny track in the session.
const QuickSelectSyntenyTrack = observer(function QuickSelectSyntenyTrack({
  model,
  setSelectedAssemblyNames,
  setSelectedRow,
}: {
  model: LinearSyntenyViewModel
  setSelectedAssemblyNames: (names: string[]) => void
  setSelectedRow: (row: number) => void
}) {
  const session = getSession(model)
  const syntenyTracks = getSyntenyTracks(session.tracks, [])
  return syntenyTracks.length ? (
    <div style={{ marginBottom: 10 }}>
      <Typography>Quick start from a synteny track</Typography>
      <Select
        displayEmpty
        value=""
        inputProps={{ 'aria-label': 'Quick start synteny track' }}
        onChange={event => {
          const track = syntenyTracks.find(
            t => t.trackId === event.target.value,
          )
          if (track) {
            const names = readConfObject(track, 'assemblyNames') as string[]
            setSelectedAssemblyNames([names[0]!, names[1]!])
            setSelectedRow(0)
            model.clearImportFormSyntenyTracks()
            model.setImportFormSyntenyTrack(0, {
              type: 'preConfigured',
              value: track.trackId,
            })
          }
        }}
      >
        <MenuItem value="" disabled>
          Select a synteny track to auto-fill assemblies
        </MenuItem>
        {syntenyTracks.map(track => (
          <MenuItem key={track.trackId} value={track.trackId}>
            {getTrackName(track, session)}
          </MenuItem>
        ))}
      </Select>
    </div>
  ) : null
})

export default QuickSelectSyntenyTrack
