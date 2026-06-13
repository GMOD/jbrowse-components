import { useEffect, useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
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
  const filteredTracks = model.tracksForAssembly(selectedAssembly)
  const firstTrack = filteredTracks[0]
  const firstTrackId = firstTrack?.track.trackId ?? ''
  const [selectedTrackId, setSelectedTrackId] = useState(firstTrackId)

  // firstTrackId is a string primitive — stable dep that changes only when the
  // assembly changes. firstTrack/model are intentionally NOT deps:
  // tracksForAssembly() returns a fresh array each render, so firstTrack is a
  // new ref every render — listing it reruns the effect on every render and
  // clobbers the user's dropdown selection back to the first track.
  useEffect(() => {
    // eslint-disable-next-line @eslint-react/set-state-in-effect -- sync with MST model on first-track change
    setSelectedTrackId(firstTrackId)
    if (firstTrack) {
      model.setFileSource(firstTrack.loc)
      model.setFileType(firstTrack.type)
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- see comment above; only re-sync on assembly change
  }, [firstTrackId])

  return (
    <div>
      {filteredTracks.length ? (
        <TextField
          select
          label="Tracks"
          variant="outlined"
          value={selectedTrackId}
          onChange={event => {
            const id = event.target.value
            setSelectedTrackId(id)
            const entry = filteredTracks.find(f => f.track.trackId === id)
            if (entry) {
              model.setFileSource(entry.loc)
              model.setFileType(entry.type)
            }
          }}
        >
          {filteredTracks.map(({ track, label }) => (
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
