import React, { useState, useEffect } from 'react'
import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'

// locals
import ImportCustomTrack from './AddCustomTrack'
import ImportSyntenyTrackSelector from './TrackSelector'
import type { LinearSyntenyViewModel } from '../../model'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { SnapshotIn } from 'mobx-state-tree'

type Conf = SnapshotIn<AnyConfigurationModel>

export default function TrackSelector({
  model,
  assembly1,
  assembly2,
  preConfiguredSyntenyTrack,
  setPreConfiguredSyntenyTrack,
  setUserOpenedSyntenyTrack,
}: {
  model: LinearSyntenyViewModel
  assembly1: string
  assembly2: string
  preConfiguredSyntenyTrack: string | undefined
  setUserOpenedSyntenyTrack: (arg: Conf) => void
  setPreConfiguredSyntenyTrack: (arg?: string) => void
}) {
  const [choice, setChoice] = useState('tracklist')

  useEffect(() => {
    if (choice === 'none') {
      setPreConfiguredSyntenyTrack(undefined)
      setUserOpenedSyntenyTrack(undefined)
    }
  }, [choice, setPreConfiguredSyntenyTrack, setUserOpenedSyntenyTrack])
  return (
    <div>
      <FormControl>
        <RadioGroup
          row
          value={choice}
          onChange={event => {
            setChoice(event.target.value)
          }}
          aria-labelledby="group-label"
        >
          <FormControlLabel value="none" control={<Radio />} label="None" />
          <FormControlLabel
            value="tracklist"
            control={<Radio />}
            label="Existing track"
          />
          <FormControlLabel
            value="custom"
            control={<Radio />}
            label="New track"
          />
        </RadioGroup>
      </FormControl>
      {choice === 'custom' ? (
        <ImportCustomTrack
          setUserOpenedSyntenyTrack={setUserOpenedSyntenyTrack}
          assembly2={assembly2}
          assembly1={assembly1}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          key={`${assembly1}-${assembly2}`}
          model={model}
          assembly1={assembly1}
          assembly2={assembly2}
          preConfiguredSyntenyTrack={preConfiguredSyntenyTrack}
          setPreConfiguredSyntenyTrack={setPreConfiguredSyntenyTrack}
        />
      ) : null}
    </div>
  )
}
