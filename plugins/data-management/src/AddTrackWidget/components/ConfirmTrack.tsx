import { Suspense } from 'react'

import { AssemblySelector, PluggableComponent } from '@jbrowse/core/ui'
import {
  getEnv,
  getSession,
  isElectron,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import StatusMessage from './AddTrackStatusMessage.tsx'
import UnknownAdapterPrompt from './AddTrackUnknownAdapterPrompt.tsx'
import TextIndexingConfig from './TextIndexingConfig.tsx'
import TrackAdapterSelector from './TrackAdapterSelector.tsx'
import TrackTypeSelector from './TrackTypeSelector.tsx'

import type { AddTrackModel } from '../model.ts'

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

const DefaultAddTrackExtensionComponent = observer(
  function DefaultAddTrackExtensionComponent({
    model,
  }: {
    model: AddTrackModel
  }) {
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
  },
)

const ConfirmTrack = observer(function ConfirmTrack({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const {
    trackName,
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
          helperText="A name for this track"
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

          <Suspense fallback={null}>
            <PluggableComponent
              pluginManager={pluginManager}
              name="Core-addTrackComponent"
              component={DefaultAddTrackExtensionComponent}
              props={{ model }}
            />
          </Suspense>
        </div>

        {isElectron && supportedForIndexing && (
          <FormControl>
            <FormControlLabel
              label="Index track for text searching?"
              control={
                <Checkbox
                  checked={textIndexTrack}
                  onChange={e => {
                    model.setTextIndexTrack(e.target.checked)
                  }}
                />
              }
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
