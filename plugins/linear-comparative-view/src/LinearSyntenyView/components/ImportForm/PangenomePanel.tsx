import { useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import {
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

function getMultiSyntenyTracks(model: LinearSyntenyViewModel) {
  const session = getSession(model)
  const { tracks, sessionTracks = [] } = session as typeof session & {
    sessionTracks?: AnyConfigurationModel[]
  }
  return [...tracks, ...sessionTracks].filter(
    t => t.type === 'MultiSyntenyTrack',
  )
}

function toggleInSet<T>(set: Set<T>, item: T) {
  const next = new Set(set)
  if (next.has(item)) {
    next.delete(item)
  } else {
    next.add(item)
  }
  return next
}

const PangenomePanel = observer(function PangenomePanel({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  const session = getSession(model)
  const multiSyntenyTracks = getMultiSyntenyTracks(model)

  const [selectedTrackId, setSelectedTrackId] = useState(
    multiSyntenyTracks[0]?.trackId ?? '',
  )
  const [disabledAssemblies, setDisabledAssemblies] = useState(
    new Set<string>(),
  )

  const selectedTrack = multiSyntenyTracks.find(
    t => t.trackId === selectedTrackId,
  )
  const trackAssemblies: string[] = selectedTrack
    ? readConfObject(selectedTrack, 'assemblyNames')
    : []
  const selectedAssemblies = trackAssemblies.filter(
    a => !disabledAssemblies.has(a),
  )

  if (multiSyntenyTracks.length === 0) {
    return (
      <Typography color="text.secondary">
        No multi-synteny tracks found. Add a MultiSyntenyTrack to your
        configuration to use pangenome mode.
      </Typography>
    )
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>Select a pangenome track</div>
      <Select
        value={selectedTrackId}
        onChange={e => {
          setSelectedTrackId(e.target.value)
          setDisabledAssemblies(new Set())
        }}
      >
        {multiSyntenyTracks.map(track => (
          <MenuItem key={track.trackId} value={track.trackId}>
            {getTrackName(track, session)}
          </MenuItem>
        ))}
      </Select>

      {trackAssemblies.length > 0 ? (
        <>
          <div style={{ marginTop: 16, marginBottom: 8 }}>
            Assemblies ({selectedAssemblies.length} of {trackAssemblies.length}{' '}
            selected)
            <Button
              size="small"
              onClick={() => {
                setDisabledAssemblies(new Set())
              }}
            >
              Select all
            </Button>
            <Button
              size="small"
              onClick={() => {
                setDisabledAssemblies(new Set(trackAssemblies))
              }}
            >
              Deselect all
            </Button>
          </div>
          <FormGroup sx={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {trackAssemblies.map(name => (
              <FormControlLabel
                key={name}
                control={
                  <Checkbox
                    checked={!disabledAssemblies.has(name)}
                    onChange={() => {
                      setDisabledAssemblies(prev => toggleInSet(prev, name))
                    }}
                  />
                }
                label={name}
              />
            ))}
          </FormGroup>
        </>
      ) : null}

      <Button
        sx={{ mt: 2 }}
        disabled={selectedAssemblies.length < 2}
        onClick={() => {
          model.setInit({
            views: selectedAssemblies.map(name => ({ assembly: name })),
            tracks: Array.from(
              { length: selectedAssemblies.length - 1 },
              () => [selectedTrackId],
            ),
          })
        }}
        variant="contained"
        color="primary"
      >
        Launch
      </Button>
    </>
  )
})

export default PangenomePanel
