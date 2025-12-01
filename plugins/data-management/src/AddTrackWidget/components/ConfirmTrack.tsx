import { Suspense, useEffect, useState } from 'react'

import { AssemblySelector } from '@jbrowse/core/ui'
import {
  getEnv,
  getSession,
  isElectron,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import StatusMessage from './AddTrackStatusMessage'
import UnknownAdapterPrompt from './AddTrackUnknownAdapterPrompt'
import TextIndexingConfig from './TextIndexingConfig'
import TrackAdapterSelector from './TrackAdapterSelector'
import TrackTypeSelector from './TrackTypeSelector'
import Unsupported from './Unsupported'

import type { AddTrackModel } from '../model'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

const ConfirmTrack = observer(function ConfirmTrack({
  model,
}: {
  model: AddTrackModel
}) {
  const { classes } = useStyles()
  const [check, setCheck] = useState(true)
  const session = getSession(model)
  const {
    trackName,
    unsupported,
    trackAdapter,
    trackType,
    warningMessage,
    adapterHint,
  } = model

  useEffect(() => {
    if (adapterHint === '' && trackAdapter) {
      model.setAdapterHint(trackAdapter.type)
    }
  }, [adapterHint, trackAdapter, trackAdapter?.type, model])

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
          label="trackName"
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
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
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
                  checked={check}
                  onChange={e => {
                    setCheck(e.target.checked)
                    model.setTextIndexTrack(e.target.checked)
                  }}
                />
              }
            />
          </FormControl>
        )}
        {isElectron && check && supportedForIndexing ? (
          <TextIndexingConfig model={model} />
        ) : null}
      </div>
    )
  }
})

export default ConfirmTrack
