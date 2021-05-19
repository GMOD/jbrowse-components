import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import Link from '@material-ui/core/Link'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import React from 'react'
import { UNKNOWN } from '@jbrowse/core/util/tracks'
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

function UnknownAdapterPrompt({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  const session = getSession(model)
  const { adapterHint } = model
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
      <TextField
        className={classes.spacing}
        value={adapterHint}
        label="adapterType"
        helperText="An adapter type"
        select
        fullWidth
        onChange={event => {
          model.setAdapterHint(event.target.value)
        }}
        SelectProps={{
          // @ts-ignore
          SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
        }}
      >
        {getEnv(session)
          .pluginManager.getElementTypesInGroup('adapter')
          // Exclude SNPCoverageAdapter from primary adapter user selection
          .filter((elt: { name: string }) => elt.name !== 'SNPCoverageAdapter')
          .map((elt: { name: string }) => (
            <MenuItem key={elt.name} value={elt.name}>
              {elt.name}
            </MenuItem>
          ))}
      </TextField>
    </>
  )
}

function ConfirmTrack({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  const session = getSession(model)
  const { trackName, trackAdapter, trackType, assembly, warningMessage } = model

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
    <>
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
        {getEnv(session)
          .pluginManager.getElementTypesInGroup('track')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map(({ name }: any) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
      </TextField>
      <TextField
        value={assembly}
        label="assemblyName"
        helperText="Assembly to which the track will be added"
        select
        fullWidth
        onChange={event => {
          model.setAssembly(event.target.value)
        }}
        SelectProps={{
          // @ts-ignore
          SelectDisplayProps: { 'data-testid': 'assemblyNameSelect' },
        }}
      >
        {session.assemblies.map(assemblyConf => {
          const assemblyName = readConfObject(assemblyConf, 'name')
          return (
            <MenuItem key={assemblyName} value={assemblyName}>
              {assemblyName}
            </MenuItem>
          )
        })}
      </TextField>
    </>
  )
}

export default observer(ConfirmTrack)
