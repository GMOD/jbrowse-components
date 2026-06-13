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

  // Reset the dropdown to the first track when the assembly changes. Adjusting
  // state during render (instead of in an effect) avoids the extra
  // render-with-stale-value pass. firstTrackId is a string primitive so the
  // guard fires only on an actual assembly change, not on every render.
  const [selectedTrackId, setSelectedTrackId] = useState(firstTrackId)
  const [prevFirstTrackId, setPrevFirstTrackId] = useState(firstTrackId)
  if (firstTrackId !== prevFirstTrackId) {
    setPrevFirstTrackId(firstTrackId)
    setSelectedTrackId(firstTrackId)
  }

  // Push the first track into the MST model so isReadyToOpen (and thus the Open
  // button) is satisfied by default. This is a genuine external-store sync, so
  // it stays in an effect. Gate on the firstTrackId primitive, not firstTrack:
  // tracksForAssembly() returns a fresh array each render, so depending on
  // firstTrack would re-run every render and clobber the user's selection.
  useEffect(() => {
    if (firstTrack) {
      model.setFileSource(firstTrack.loc)
      model.setFileType(firstTrack.type)
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps -- only re-sync on assembly change; see comment above
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
