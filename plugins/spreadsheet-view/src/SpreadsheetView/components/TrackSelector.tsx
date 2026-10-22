import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { coarseStripHTML } from '@jbrowse/core/util'
import { MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { ImportWizardModel } from '../ImportWizard.ts'

// The parent seeds the model with the first track (selectDefaultTrack) and
// keys this on the assembly, so a switch remounts on that track.
const TrackSelector = observer(function TrackSelector({
  model,
  selectedAssembly,
}: {
  model: ImportWizardModel
  selectedAssembly: string
}) {
  const tracks = model.tracksForAssembly(selectedAssembly)
  const [selectedTrackId, setSelectedTrackId] = useState(
    tracks[0]?.track.trackId ?? '',
  )

  return (
    <div>
      {tracks.length ? (
        <TextField
          select
          label="Tracks"
          variant="outlined"
          value={selectedTrackId}
          onChange={event => {
            const id = event.target.value
            setSelectedTrackId(id)
            const entry = tracks.find(f => f.track.trackId === id)
            if (entry) {
              model.setFileSource(entry.loc)
              model.setFileType(entry.type)
            }
          }}
        >
          {tracks.map(({ track, label }) => (
            <MenuItem key={track.trackId} value={track.trackId}>
              {coarseStripHTML(label)}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <ErrorBanner error={`No tracks found for ${selectedAssembly}`} />
      )}
    </div>
  )
})

export default TrackSelector
