import React, { useState, useEffect } from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { ErrorMessage } from '@jbrowse/core/ui'
import { TrackSelector as TrackSelectorIcon } from '@jbrowse/core/ui/Icons'
import { getSession } from '@jbrowse/core/util'
import { getTrackName } from '@jbrowse/core/util/tracks'
import { Select, MenuItem, Paper, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import type { DotplotViewModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

// icons

// locals

function f(track: AnyConfigurationModel, assembly1: string, assembly2: string) {
  const assemblyNames = readConfObject(track, 'assemblyNames')
  return (
    assemblyNames.includes(assembly1) &&
    assemblyNames.includes(assembly2) &&
    track.type.includes('Synteny')
  )
}

const Selector = observer(
  ({
    model,
    assembly1,
    assembly2,
    setShowTrackId,
  }: {
    model: DotplotViewModel
    assembly1: string
    assembly2: string
    setShowTrackId: (arg: string) => void
  }) => {
    const session = getSession(model)
    const { tracks, sessionTracks } = session
    const allTracks = [
      ...tracks,
      ...(sessionTracks || []),
    ] as AnyConfigurationModel[]
    const filteredTracks = allTracks.filter(t => f(t, assembly2, assembly1))
    const resetTrack = filteredTracks[0]?.trackId || ''
    const [value, setValue] = useState(resetTrack)
    useEffect(() => {
      // if assembly1/assembly2 changes, then we will want to use this effect to change
      // the state of the useState because it otherwise gets locked to a stale value
      setValue(resetTrack)
    }, [resetTrack])

    useEffect(() => {
      // sets track data in a useEffect because the initial load is needed as well as
      // onChange's to the select box
      setShowTrackId(value)
    }, [value, setShowTrackId])

    return (
      <Paper style={{ padding: 12 }}>
        <Typography paragraph>
          Select a track from the select box below, the track will be shown when
          you hit "Launch".
        </Typography>

        <Typography paragraph>
          Note: there is a track selector <i>inside</i> the DotplotView, which
          can turn on one or more SyntenyTracks (more than one can be displayed
          at once). Look for the track selector icon <TrackSelectorIcon />
        </Typography>
        {filteredTracks.length ? (
          <Select
            value={value}
            onChange={event => {
              setValue(event.target.value)
            }}
          >
            {filteredTracks.map(track => (
              <MenuItem key={track.trackId} value={track.trackId}>
                {getTrackName(track, session)}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <ErrorMessage
            error={`No synteny tracks found for ${assembly1},${assembly2}`}
          />
        )}
      </Paper>
    )
  },
)

export default Selector
