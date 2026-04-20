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
  const filteredTracks = model.tracksForAssembly(selectedAssembly)
  const firstTrack = filteredTracks[0]
  const firstTrackId = firstTrack?.track.trackId ?? ''
  const [selectedTrackId, setSelectedTrackId] = useState(firstTrackId)

  // firstTrackId is a string primitive — stable dep that changes only when the
  // assembly changes, avoiding the "new array ref on every render" problem
  useEffect(() => {
    setSelectedTrackId(firstTrackId)
    if (firstTrack) {
      model.setFileSource(firstTrack.loc)
      model.setFileType(firstTrack.type)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <ErrorMessage error={`No tracks found for ${selectedAssembly}`} />
      )}
    </div>
  )
})

export default TrackSelector
