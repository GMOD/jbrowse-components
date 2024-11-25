import React, { useEffect, useState } from 'react'
import { AssemblySelector } from '@jbrowse/core/ui'
import {
  isSupportedIndexingAdapter,
  getSession,
  isElectron,
} from '@jbrowse/core/util'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Link,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import TextIndexingConfig from './TextIndexingConfig'
import TrackAdapterSelector from './TrackAdapterSelector'
import TrackTypeSelector from './TrackTypeSelector'
import type { AddTrackModel } from '../model'

const useStyles = makeStyles()(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

function StatusMessage({
  trackAdapter,
  trackType,
}: {
  trackAdapter: { type: string; subadapter?: { type: string } }
  trackType: string
}) {
  const { classes } = useStyles()
  const { type, subadapter } = trackAdapter
  return type === 'SNPCoverageAdapter' ? (
    <Typography className={classes.spacing}>
      Selected <code>{trackType}</code>. Using adapter <code>{type}</code> with
      subadapter <code>{subadapter?.type}</code>. Please enter a track name and,
      if necessary, update the track type.
    </Typography>
  ) : (
    <Typography className={classes.spacing}>
      Using adapter <code>{type}</code> and guessing track type{' '}
      <code>{trackType}</code>. Please enter a track name and, if necessary,
      update the track type.
    </Typography>
  )
}

function UnknownAdapterPrompt({ model }: { model: AddTrackModel }) {
  const { classes } = useStyles()
  return (
    <>
      <Typography className={classes.spacing}>
        JBrowse was not able to guess the adapter type for this data, but it may
        be in the list below. If not, you can{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          check for new releases
        </Link>{' '}
        of JBrowse to see if they support this data type or{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          file an issue
        </Link>{' '}
        and add a feature request for this data type.
      </Typography>
      <TrackAdapterSelector model={model} />
    </>
  )
}

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
    return (
      <Typography className={classes.spacing}>
        This version of JBrowse cannot display data of this type. It is
        possible, however, that there is a newer version that can display them.
        You can{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/releases"
          target="_blank"
          rel="noopener noreferrer"
        >
          check for new releases
        </Link>{' '}
        of JBrowse or{' '}
        <Link
          href="https://github.com/GMOD/jbrowse-components/issues/new"
          target="_blank"
          rel="noopener noreferrer"
        >
          file an issue
        </Link>{' '}
        and add a feature request for this data type.
      </Typography>
    )
  }
  if (trackAdapter?.type === UNKNOWN) {
    return <UnknownAdapterPrompt model={model} />
  }

  if (!trackAdapter?.type) {
    return <Typography>Could not recognize this data type.</Typography>
  }

  const supportedForIndexing = isSupportedIndexingAdapter(trackAdapter.type)
  return (
    <div>
      <StatusMessage trackAdapter={trackAdapter} trackType={trackType} />
      {warningMessage ? (
        <Typography style={{ color: 'orange' }}>{warningMessage}</Typography>
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
          htmlInput: { 'data-testid': 'trackNameInput' },
        }}
      />
      <TrackAdapterSelector model={model} />
      <TrackTypeSelector model={model} />
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
            // @ts-expect-error
            SelectDisplayProps: { 'data-testid': 'assemblyNameSelect' },
          },
        }}
      />
      {isElectron && supportedForIndexing && (
        <FormControl>
          <FormControlLabel
            label={'Index track for text searching?'}
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
})

export default ConfirmTrack
