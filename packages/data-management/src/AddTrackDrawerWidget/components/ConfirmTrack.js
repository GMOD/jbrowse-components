import { readConfObject } from '@gmod/jbrowse-core/configuration'
import {
  guessAdapter,
  guessSNPCoverageSubadapter,
  guessTrackType,
  UNKNOWN,
  UNSUPPORTED,
} from '@gmod/jbrowse-core/util/tracks'
import Link from '@material-ui/core/Link'
import MenuItem from '@material-ui/core/MenuItem'
import { makeStyles } from '@material-ui/core/styles'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React, { useEffect } from 'react'

const useStyles = makeStyles(theme => ({
  spacing: {
    marginBottom: theme.spacing(3),
  },
}))

function ConfirmTrack({
  trackData,
  trackName,
  setTrackAdapter,
  setTrackName,
  trackType,
  setTrackType,
  trackAdapter,
  assemblyName,
  setAssemblyName,
  session,
}) {
  const classes = useStyles()
  useEffect(() => {
    if (trackData.uri) {
      const adapter = guessAdapter(trackData.uri, 'uri')
      setTrackAdapter(adapter)
      setTrackType(guessTrackType(adapter.type))
    }
    if (trackData.localPath) {
      const adapter = guessAdapter(trackData.localPath, 'localPath')
      setTrackAdapter(adapter)
      setTrackType(guessTrackType(adapter.type))
    }
    if (trackData.config) setTrackAdapter({ type: 'FromConfigAdapter' })
  }, [trackData, setTrackAdapter, setTrackType])

  if (trackAdapter.type === UNSUPPORTED)
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
  if (trackAdapter.type === UNKNOWN)
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
            setTrackAdapter({ type: event.target.value })
            setTrackType(guessTrackType(event.target.value))
          }}
          SelectProps={{
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
  if (!trackAdapter.type)
    // TODO: if file type is unrecognized, provide some way of specifying
    // adapter and guessing reasonable default for it.
    return <Typography>Could not recognize this data type.</Typography>
  if (trackData.uri || trackData.localPath || trackData.config) {
    let message = null
    if (trackData.uri || trackData.localPath)
      trackAdapter.type === 'SNPCoverageAdapter'
        ? (message = (
            <Typography className={classes.spacing}>
              Selected <code>{trackType}</code>. Using adapter{' '}
              <code>{trackAdapter.type}</code> with subadapter{' '}
              <code>{trackAdapter.subadapter.type}</code>. Please enter a track
              name and, if necessary, update the track type.
              {/* Using adapter <code>{trackAdapter.type}</code> with subadapter{' '}
              <code>{trackAdapter.subadapter.type}</code> and guessing track
              type <code>{trackType}</code>. Please enter a track name and, if
              necessary, update the track type. */}
            </Typography>
          ))
        : (message = (
            <Typography className={classes.spacing}>
              Using adapter <code>{trackAdapter.type}</code> and guessing track
              type <code>{trackType}</code>. Please enter a track name and, if
              necessary, update the track type.
            </Typography>
          ))
    else
      message = (
        <Typography className={classes.spacing}>
          Please enter a track type and track name.
        </Typography>
      )
    return (
      <>
        {message}
        <TextField
          className={classes.spacing}
          label="trackName"
          helperText="A name for this track"
          fullWidth
          value={trackName}
          onChange={event => setTrackName(event.target.value)}
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
            setTrackType(event.target.value)
            // selecting SNPCoverageTrack sets up SNPCoverage adapter. If
            // switching from SNP to non-SNP, restore old adapter
            if (event.target.value === 'SNPCoverageTrack') {
              const adapter = trackData.uri
                ? guessSNPCoverageSubadapter(trackData.uri, 'uri')
                : guessSNPCoverageSubadapter(trackData.localPath, 'localPath')
              setTrackAdapter(adapter)
            } else if (trackAdapter.type === 'SNPCoverageAdapter') {
              setTrackAdapter(trackAdapter.subadapter)
            }
          }}
          SelectProps={{
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
          value={assemblyName}
          label="assemblyName"
          helperText="Assembly to which the track will be added"
          select
          fullWidth
          onChange={event => setAssemblyName(event.target.value)}
          SelectProps={{
            SelectDisplayProps: { 'data-testid': 'assemblyNameSelect' },
          }}
        >
          {session.assemblies.map(assembly => {
            const newAssemblyName = readConfObject(assembly, 'name')
            return (
              <MenuItem key={newAssemblyName} value={newAssemblyName}>
                {newAssemblyName}
              </MenuItem>
            )
          })}
        </TextField>
      </>
    )
  }
  return <></>
}

ConfirmTrack.propTypes = {
  assemblyName: PropTypes.string.isRequired,
  setAssemblyName: PropTypes.func.isRequired,
  trackData: PropTypes.shape({
    uri: PropTypes.string,
    localPath: PropTypes.string,
    config: PropTypes.array,
  }).isRequired,
  trackName: PropTypes.string.isRequired,
  setTrackName: PropTypes.func.isRequired,
  trackType: PropTypes.string,
  setTrackType: PropTypes.func.isRequired,
  trackAdapter: PropTypes.shape({
    type: PropTypes.string,
    subadapter: PropTypes.shape({
      type: PropTypes.string,
    }),
  }).isRequired,
  setTrackAdapter: PropTypes.func.isRequired,
  session: MobxPropTypes.observableObject.isRequired,
}

ConfirmTrack.defaultProps = {
  trackType: '',
}

export default observer(ConfirmTrack)
