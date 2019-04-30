import { withStyles } from '@material-ui/core'
import Link from '@material-ui/core/Link'
import MenuItem from '@material-ui/core/MenuItem'
import TextField from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import PropTypes from 'prop-types'
import React from 'react'
import {
  guessAdapter,
  guessTrackType,
  UNSUPPORTED,
} from '@gmod/jbrowse-core/util/tracks'

const styles = theme => ({
  spacing: {
    marginBottom: theme.spacing.unit * 3,
  },
})

class ConfirmTrack extends React.Component {
  static propTypes = {
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
    trackData: PropTypes.shape({
      uri: PropTypes.string,
      localPath: PropTypes.string,
      config: PropTypes.array,
    }).isRequired,
    trackName: PropTypes.string.isRequired,
    updateTrackName: PropTypes.func.isRequired,
    trackType: PropTypes.string,
    updateTrackType: PropTypes.func.isRequired,
    trackAdapter: PropTypes.shape({
      type: PropTypes.string,
    }).isRequired,
    updateTrackAdapter: PropTypes.func.isRequired,
    rootModel: MobxPropTypes.observableObject.isRequired,
  }

  static defaultProps = {
    trackType: '',
  }

  componentDidMount() {
    const { trackData, updateTrackAdapter, updateTrackType } = this.props
    if (trackData.uri) {
      const adapter = guessAdapter(trackData.uri, 'uri')
      updateTrackAdapter(adapter)
      updateTrackType({ target: { value: guessTrackType(adapter.type) } })
    }
    if (trackData.localPath) {
      const adapter = guessAdapter(trackData.localPath, 'localPath')
      updateTrackAdapter(adapter)
      updateTrackType({ target: { value: guessTrackType(adapter.type) } })
    }
    if (trackData.config) updateTrackAdapter({ type: 'FromConfigAdapter' })
  }

  render() {
    const {
      classes,
      trackData,
      trackName,
      updateTrackName,
      trackType,
      updateTrackType,
      trackAdapter,
      rootModel,
    } = this.props
    if (trackAdapter.type === UNSUPPORTED)
      return (
        <Typography className={classes.spacing}>
          This version of JBrowse cannot display files of this type. It is
          possible, however, that there is a newer version that can display
          them. You can{' '}
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
          requesting support for this file type.
        </Typography>
      )
    if (!trackAdapter.type)
      // TODO: if file type is unrecognized, provide some way of specifying
      // adapter and guessing reasonable default for it.
      return <Typography>Could not recognize this file type.</Typography>
    if (trackData.uri || trackData.localPath || trackData.config) {
      let message = <></>
      if (trackData.uri || trackData.localPath)
        message = (
          <Typography className={classes.spacing}>
            Using adapter <code>{trackAdapter.type}</code> and guessing track
            type <code>{trackType}</code>. Please enter a track name and, if
            necessary, update the track type.
          </Typography>
        )
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
            onChange={updateTrackName}
          />
          <TextField
            value={trackType}
            label="trackType"
            helperText="A track type"
            select
            fullWidth
            onChange={updateTrackType}
          >
            {rootModel.pluginManager
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
        </>
      )
    }
    return <></>
  }
}

export default withStyles(styles)(observer(ConfirmTrack))
