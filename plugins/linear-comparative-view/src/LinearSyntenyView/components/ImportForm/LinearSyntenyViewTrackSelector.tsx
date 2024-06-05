import React, { useState, useEffect } from 'react'
import {
  FormControl,
  FormLabel,
  FormControlLabel,
  Radio,
  RadioGroup,
} from '@mui/material'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { SnapshotIn } from 'mobx-state-tree'

// locals
import { LinearSyntenyViewModel } from '../../model'
import ImportCustomTrack from './ImportCustomTrack'
import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelector'

type Conf = SnapshotIn<AnyConfigurationModel>

const LinearSyntenyViewTrackSelector = observer(function ({
  setSessionTrackData,
  setShowTrackId,
  sessionTrackData,
  assembly1,
  assembly2,
  model,
}: {
  sessionTrackData: Conf
  setSessionTrackData: (arg: Conf) => void
  setShowTrackId: (arg?: string) => void
  model: LinearSyntenyViewModel
  assembly1: string
  assembly2: string
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
          (Optional) Select or add a synteny track
        </FormLabel>
        <RadioGroup
          row
          value={choice}
          onChange={event => setChoice(event.target.value)}
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
          model={model}
          assembly1={assembly1}
          assembly2={assembly2}
          setShowTrackId={setShowTrackId}
        />
      ) : null}
    </>
  )
})

export default LinearSyntenyViewTrackSelector
