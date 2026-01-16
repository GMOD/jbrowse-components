import { Suspense, useEffect } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
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
import Unsupported from './Unsupported.tsx'

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

const ConfirmTrack = observer(function ConfirmTrack({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const {
    trackName,
    unsupported,
    trackAdapter,
    trackType,
    warningMessage,
    adapterHint,
    textIndexTrack,
  } = model

  useEffect(() => {
    if (adapterHint === '' && trackAdapter) {
      model.setAdapterHint(trackAdapter.type)
    }
  }, [adapterHint, trackAdapter, model])

  if (unsupported) {
    return <Unsupported />
  } else if (trackAdapter?.type === UNKNOWN) {
    return <UnknownAdapterPrompt model={model} />
  } else if (!trackAdapter?.type) {
    return <Typography>Could not recognize this data type.</Typography>
  } else {
    const supportedForIndexing = isSupportedIndexingAdapter(trackAdapter.type)
    const { pluginManager } = getEnv(model)
    const Component = pluginManager.evaluateExtensionPoint(
      'Core-addTrackComponent',
      ({ model }: { model: AddTrackModel }) => (
        <AssemblySelector
          session={session}
          helperText="Select assembly to add track to"
          selected={model.assembly}
          onChange={asm => {
            model.setAssembly(asm)
          }}
          TextFieldProps={{
            fullWidth: true,
            SelectProps: {
              SelectDisplayProps: {
                // @ts-expect-error
                'data-testid': 'assemblyNameSelect',
              },
            },
          }}
        />
      ),
      { model },
    ) as React.FC<any>
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
            <Component model={model} />
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
