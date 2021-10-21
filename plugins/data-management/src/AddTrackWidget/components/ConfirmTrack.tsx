import React from 'react'
import {
  Link,
  MenuItem,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import PluginManager from '@jbrowse/core/PluginManager'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { UNKNOWN } from '@jbrowse/core/util/tracks'

// locals
import { AddTrackModel } from '../model'

const useStyles = makeStyles(theme => ({
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
  const classes = useStyles()
  return trackAdapter.type === 'SNPCoverageAdapter' ? (
    <Typography className={classes.spacing}>
      Selected <code>{trackType}</code>. Using adapter{' '}
      <code>{trackAdapter.type}</code> with subadapter{' '}
      <code>{trackAdapter.subadapter?.type}</code>. Please enter a track name
      and, if necessary, update the track type.
    </Typography>
  ) : (
    <Typography className={classes.spacing}>
      Using adapter <code>{trackAdapter.type}</code> and guessing track type{' '}
      <code>{trackType}</code>. Please enter a track name and, if necessary,
      update the track type.
    </Typography>
  )
}

function getAdapterTypes(pluginManager: PluginManager) {
  return pluginManager.getElementTypesInGroup('adapter') as { name: string }[]
}

function getTrackTypes(pluginManager: PluginManager) {
  return pluginManager.getElementTypesInGroup('track') as { name: string }[]
}

const TrackAdapterSelector = observer(({ model }: { model: AddTrackModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { trackAdapter } = model
  const type = trackAdapter?.type
  return (
    <TextField
      className={classes.spacing}
      value={type === 'UNKNOWN' ? '' : type}
      label="adapterType"
      helperText="An adapter type"
      select
      fullWidth
      onChange={event => model.setAdapterHint(event.target.value)}
      SelectProps={{
        // @ts-ignore
        SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
      }}
    >
      {
        // Exclude SNPCoverageAdapter from primary adapter user selection
        getAdapterTypes(getEnv(session).pluginManager)
          .filter(elt => elt.name !== 'SNPCoverageAdapter')
          .map(elt => elt.name)
          .map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))
      }
    </TextField>
  )
})

function UnknownAdapterPrompt({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  return (
    <>
      <Typography className={classes.spacing}>
        Was not able to guess the adapter type for this data, but it may be in
        the list below. If not, you can{' '}
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

const TrackTypeSelector = observer(({ model }: { model: AddTrackModel }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { trackType } = model

  return (
    <TextField
      className={classes.spacing}
      value={trackType}
      label="trackType"
      helperText="A track type"
      select
      fullWidth
      onChange={event => {
        model.setTrackType(event.target.value)
      }}
      SelectProps={{
        // @ts-ignore
        SelectDisplayProps: { 'data-testid': 'trackTypeSelect' },
      }}
    >
      {getTrackTypes(getEnv(session).pluginManager).map(({ name }) => (
        <MenuItem key={name} value={name}>
          {name}
        </MenuItem>
      ))}
    </TextField>
  )
})

const TrackAssemblySelector = observer(
  ({ model }: { model: AddTrackModel }) => {
    const session = getSession(model)
    const { assembly } = model
    return (
      <TextField
        value={assembly}
        label="assemblyName"
        helperText="Assembly to which the track will be added"
        select
        fullWidth
        onChange={event => model.setAssembly(event.target.value)}
        SelectProps={{
          // @ts-ignore
          SelectDisplayProps: { 'data-testid': 'assemblyNameSelect' },
        }}
      >
        {session.assemblies
          .map(conf => readConfObject(conf, 'name'))
          .map(name => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
      </TextField>
    )
  },
)

function ConfirmTrack({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  const { trackName, trackAdapter, trackType, warningMessage } = model

  if (model.unsupported) {
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

  return (
    <div>
      {trackAdapter ? (
        <StatusMessage trackAdapter={trackAdapter} trackType={trackType} />
      ) : null}
      {warningMessage ? (
        <Typography style={{ color: 'orange' }}>{warningMessage}</Typography>
      ) : null}
      <TextField
        className={classes.spacing}
        label="trackName"
        helperText="A name for this track"
        fullWidth
        value={trackName}
        onChange={event => model.setTrackName(event.target.value)}
        inputProps={{ 'data-testid': 'trackNameInput' }}
      />
      <TrackAdapterSelector model={model} />
      <TrackTypeSelector model={model} />
      <TrackAssemblySelector model={model} />
    </div>
  )
}

export default observer(ConfirmTrack)
