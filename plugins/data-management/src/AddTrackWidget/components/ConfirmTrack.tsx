import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { guessAdapter, UNKNOWN, UNSUPPORTED } from '@jbrowse/core/util/tracks'
import Link from '@material-ui/core/Link'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { observer } from 'mobx-react'
import React, { useState, useEffect } from 'react'
import { AddTrackModel } from '../model'

const useStyles = makeStyles(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

function ConfirmTrack({ model }: { model: AddTrackModel }) {
  const classes = useStyles()
  const session = getSession(model)
  const [error, setError] = useState<string>()
  const {
    trackName,
    trackData,
    trackAdapter,
    trackType,
    indexTrackData,
    assembly,
  } = model
  useEffect(() => {
    if (trackData?.uri) {
      const adapter = guessAdapter(trackData.uri, 'uri', indexTrackData.uri)
      model.setTrackAdapter(adapter)

      // check for whether the user entered an absolute URL
      if (
        !(
          (indexTrackData.uri && indexTrackData.uri.startsWith('http')) ||
          trackData.uri.startsWith('http')
        )
      ) {
        setError(
          `Warning: one or more of your files do not provide the protocol e.g.
          https://, please provide an absolute URL unless you are sure a
          relative URL is intended.`,
        )
      }

      // check for accessing an http url when we are running on https, which is
      // disallowed
      else if (
        window.location.protocol === 'https:' &&
        ((indexTrackData.uri && indexTrackData.uri.startsWith('http://')) ||
          trackData.uri.startsWith('http://'))
      ) {
        setError(
          `Warning: You entered a http:// resources but we cannot access HTTP
          resources from JBrowse when it is running on https. Please use an
          https URL for your track, or access the JBrowse app from the http
          protocol`,
        )
      }

      // check for ftp url inputs
      else if (
        (indexTrackData.uri && indexTrackData.uri.startsWith('ftp://')) ||
        trackData.uri.startsWith('ftp://')
      ) {
        setError(`Warning: JBrowse cannot access files using the ftp protocol`)
      }
    }
    if (trackData.localPath) {
      const adapter = guessAdapter(trackData.localPath, 'localPath')
      model.setTrackAdapter(adapter)
    }
  }, [model, trackData, indexTrackData])

  if (trackAdapter.type === UNSUPPORTED) {
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
  if (trackAdapter.type === UNKNOWN) {
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
          value={trackAdapter}
          label="adapterType"
          helperText="An adapter type"
          select
          fullWidth
          onChange={event => {
            model.setTrackAdapter({ type: event.target.value })
          }}
          SelectProps={{
            // @ts-ignore
            SelectDisplayProps: { 'data-testid': 'adapterTypeSelect' },
          }}
        >
          {session.pluginManager.getElementTypesInGroup('adapter').map(
            installedAdapterType =>
              // Exclude SNPCoverageAdapter from primary adapter user selection
              installedAdapterType.name !== 'SNPCoverageAdapter' && (
                <MenuItem
                  key={installedAdapterType.name}
                  value={installedAdapterType.name}
                >
                  {installedAdapterType.name}
                </MenuItem>
              ),
          )}
        </TextField>
      </>
    )
  }
  if (!trackAdapter.type) {
    // TODO: if file type is unrecognized, provide some way of specifying
    // adapter and guessing reasonable default for it.
    return <Typography>Could not recognize this data type.</Typography>
  }
  if (trackData.uri || trackData.localPath || trackData.config) {
    let message = null
    if (trackData.uri || trackData.localPath) {
      message =
        trackAdapter.type === 'SNPCoverageAdapter' ? (
          <Typography className={classes.spacing}>
            Selected <code>{trackType}</code>. Using adapter{' '}
            <code>{trackAdapter.type}</code> with subadapter{' '}
            <code>{trackAdapter.subadapter.type}</code>. Please enter a track
            name and, if necessary, update the track type.
          </Typography>
        ) : (
          <Typography className={classes.spacing}>
            Using adapter <code>{trackAdapter.type}</code> and guessing track
            type <code>{trackType}</code>. Please enter a track name and, if
            necessary, update the track type.
          </Typography>
        )
    } else {
      message = (
        <Typography className={classes.spacing}>
          Please enter a track type and track name.
        </Typography>
      )
    }
    return (
      <>
        {message}
        {error ? (
          <Typography style={{ color: 'orange' }}>{error}</Typography>
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
          {session.pluginManager
            .getElementTypesInGroup('track')
            .map(installedTrackType => (
              <MenuItem
                key={installedTrackType.name}
                value={installedTrackType.name}
              >
                {installedTrackType.name}
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
  return <></>
}

export default observer(ConfirmTrack)
