import { useEffect, useState } from 'react'

import { ErrorMessage } from '@jbrowse/core/ui'
import { coarseStripHTML } from '@jbrowse/core/util'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { ImportWizardModel } from '../ImportWizard.ts'

const TrackSelector = observer(function TrackSelector({
  model,
  selectedAssembly,
}: {
  model: ImportWizardModel
  selectedAssembly: string
}) {
  const filteredTracks = selectedAssembly
    ? model.tracksForAssembly(selectedAssembly)
    : undefined
  const resetTrack = filteredTracks?.[0]?.track.trackId || ''
  const [selectedTrack, setSelectedTrack] = useState(resetTrack)
  useEffect(() => {
    const entry = filteredTracks?.find(f => selectedTrack === f.track.trackId)
    if (entry) {
      model.setFileSource(entry.loc)
      model.setFileType(entry.type)
    }
  }, [model, selectedTrack, filteredTracks])

  return (
    <div>
      {filteredTracks?.length ? (
        <TextField
          select
          label="Tracks"
          variant="outlined"
          value={selectedTrack}
          onChange={event => {
            setSelectedTrack(event.target.value)
          }}
        >
          {filteredTracks.map(({ track, label }) => (
            <MenuItem key={track.trackId} value={track.trackId}>
              {coarseStripHTML(label)}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <ErrorMessage error={`No tracks found for ${selectedAssembly}`} />
      )}
    </div>
  )
})

export default TrackSelector
