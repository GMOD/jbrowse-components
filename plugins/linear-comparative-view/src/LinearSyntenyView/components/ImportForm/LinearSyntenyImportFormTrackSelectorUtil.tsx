import React, { useState, useEffect } from 'react'
import {
  FormControl,
  FormLabel,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material'
import { SnapshotIn } from 'mobx-state-tree'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

// locals
import { LinearSyntenyViewModel } from '../../model'
import ImportCustomTrack from './LinearSyntenyImportFormAddCustomTrack'
import ImportSyntenyTrackSelector from './LinearSyntenyImportFormTrackSelector'

type Conf = SnapshotIn<AnyConfigurationModel>

export default function TrackSelector({
  setSessionTrackData,
  setShowTrackId,
  sessionTrackData,
  assembly1,
  assembly2,
  model,
  idx,
}: {
  sessionTrackData: Conf
  setSessionTrackData: (arg: Conf) => void
  setShowTrackId: (arg?: string) => void
  model: LinearSyntenyViewModel
  assembly1: string
  assembly2: string
  idx: number
}) {
  const [choice, setChoice] = useState('tracklist')

  useEffect(() => {
    if (choice === 'none') {
      setSessionTrackData(undefined)
      setShowTrackId(undefined)
    }
  }, [choice, setSessionTrackData, setShowTrackId])
  return (
    <>
      <FormControl>
        <FormLabel id="group-label">
          (Optional) Select or add a synteny track between row {idx} and{' '}
          {idx + 1}
        </FormLabel>
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
          setSessionTrackData={setSessionTrackData}
          sessionTrackData={sessionTrackData}
          assembly2={assembly2}
          assembly1={assembly1}
        />
      ) : null}
      {choice === 'tracklist' ? (
        <ImportSyntenyTrackSelector
          key={assembly1 + '-' + assembly2}
          model={model}
          assembly1={assembly1}
          assembly2={assembly2}
          setShowTrackId={setShowTrackId}
        />
      ) : null}
    </>
  )
}
