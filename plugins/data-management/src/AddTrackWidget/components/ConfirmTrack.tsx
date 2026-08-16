import { Suspense } from 'react'

import {
  AssemblySelector,
  LabeledCheckbox,
  PluggableComponent,
} from '@jbrowse/core/ui'
import {
  adapterNeedsAddTrackComponent,
  getEnv,
  getSession,
  isElectron,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { FormControl, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import StatusMessage from './AddTrackStatusMessage.tsx'
import UnknownAdapterPrompt from './AddTrackUnknownAdapterPrompt.tsx'
import TextIndexingConfig from './TextIndexingConfig.tsx'
import TrackAdapterSelector from './TrackAdapterSelector.tsx'
import TrackTypeSelector from './TrackTypeSelector.tsx'

import type { AddTrackModel } from '../model.ts'
import type { AddTrackComponentProps } from '@jbrowse/core/util'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
  selectorsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
}))

// The assembly dropdown is the widget's own field, not a fallback for the
// extension point — it used to be passed as the point's default component, so
// any picker that didn't happen to render one replaced the only way to choose
// an assembly with its own fields. A picker that genuinely asks for the
// assembly says so with `ownsAssembly`, and this yields to it.
const TrackAssemblySelector = observer(function TrackAssemblySelector({
  model,
}: AddTrackComponentProps) {
  const session = getSession(model)
  return (
    <AssemblySelector
      session={session}
      helperText="Select assembly to add track to"
      selected={model.assembly}
      onChange={asm => {
        model.setAssembly(asm)
      }}
      fullWidth
    />
  )
})

// The extension point contributes nothing by default: most adapters have no
// picker at all
function NoAddTrackExtension() {
  return null
}

const ConfirmTrack = observer(function ConfirmTrack({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const {
    trackName,
    submittableTrackName,
    trackAdapter,
    trackType,
    warningMessage,
    textIndexTrack,
    adapterHintNotConfigurable,
  } = model

  if (trackAdapter?.type === UNKNOWN || adapterHintNotConfigurable) {
    // Either the format couldn't be guessed, or the user picked an adapter the
    // extension point can't configure for this file. Both cases keep the
    // adapter dropdown on screen (it surfaces its own inline error) so the user
    // can recover by choosing a different adapter without going Back.
    return <UnknownAdapterPrompt model={model} />
  } else if (!trackAdapter?.type) {
    return <Typography>Could not recognize this data type.</Typography>
  } else {
    const supportedForIndexing = isSupportedIndexingAdapter(trackAdapter.type)
    const { pluginManager } = getEnv(model)
    return (
      <div>
        <StatusMessage trackAdapter={trackAdapter} trackType={trackType} />
        {warningMessage ? (
          <Typography color="warning">{warningMessage}</Typography>
        ) : null}
        <TextField
          className={classes.spacing}
          label="Track name"
          // The field can now be emptied (it used to refill itself with the
          // filename), so say why Add is disabled rather than leaving a greyed
          // button and no reason
          error={!submittableTrackName}
          helperText={
            submittableTrackName
              ? 'A name for this track'
              : 'Enter a track name'
          }
          fullWidth
          value={trackName}
          onChange={event => {
            model.setTrackName(event.target.value)
          }}
          slotProps={{
            htmlInput: {
              'data-testid': 'trackNameInput',
            },
          }}
        />
        <div className={classes.selectorsContainer}>
          <TrackAdapterSelector model={model} />
          <TrackTypeSelector model={model} />
          {adapterNeedsAddTrackComponent(
            pluginManager,
            trackAdapter.type,
          ) ? null : (
            <TrackAssemblySelector model={model} />
          )}

          <Suspense fallback={null}>
            <PluggableComponent
              pluginManager={pluginManager}
              name="Core-addTrackComponent"
              component={NoAddTrackExtension}
              props={{ model }}
            />
          </Suspense>
        </div>

        {isElectron && supportedForIndexing && (
          <FormControl>
            <LabeledCheckbox
              label="Index track for text searching?"
              checked={textIndexTrack}
              onChange={val => {
                model.setTextIndexTrack(val)
              }}
            />
          </FormControl>
        )}
        {isElectron && textIndexTrack && supportedForIndexing ? (
          <TextIndexingConfig model={model} />
        ) : null}
      </div>
    )
  }
})

export default ConfirmTrack
