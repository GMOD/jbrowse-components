import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { getSyntenyTracks } from '@jbrowse/synteny-core'
import { MenuItem, Select, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

// Auto-fill the row assemblies from an existing synteny track's assemblyNames,
// so a user with a pre-configured PAF/chain track can launch it without first
// guessing which assemblies it connects. A pairwise track fills its two rows; an
// all-vs-all track (more than two assemblyNames) stacks every assembly as a row,
// with the single track backing every adjacent band. Passing [] to
// getSyntenyTracks returns every synteny track in the session.
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
  // the Select stays on its placeholder (value="") so it reads as a one-shot
  // action; this caption confirms which track the rows were filled from
  const [filledFrom, setFilledFrom] = useState('')
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
            const rows = names.length > 2 ? [...names] : [names[0]!, names[1]!]
            setSelectedAssemblyNames(rows)
            setSelectedRow(0)
            setFilledFrom(getTrackName(track, session))
            model.clearImportFormSyntenyTracks()
            for (let idx = 0; idx < rows.length - 1; idx++) {
              model.setImportFormSyntenyTrack(idx, {
                type: 'preConfigured',
                value: track.trackId,
              })
            }
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
      {filledFrom ? (
        <Typography variant="caption" component="div" color="text.secondary">
          Filled from {filledFrom}
        </Typography>
      ) : null}
    </div>
  ) : null
})

export default QuickSelectSyntenyTrack
