import React, { useState, useEffect } from 'react'
import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material'
import { SnapshotIn } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// locals
import { LinearSyntenyViewModel } from '../../model'
import ImportCustomTrack from './AddCustomTrack'
import ImportSyntenyTrackSelector from './TrackSelector'

type Conf = SnapshotIn<AnyConfigurationModel>

export default function TrackSelector({
  model,
  assembly1,
  assembly2,
  userOpenedSyntenyTrack,
  preConfiguredSyntenyTrack,
  setPreConfiguredSyntenyTrack,
  setUserOpenedSyntenyTrack,
}: {
  model: LinearSyntenyViewModel
  assembly1: string
  assembly2: string
  userOpenedSyntenyTrack: Conf | undefined
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
