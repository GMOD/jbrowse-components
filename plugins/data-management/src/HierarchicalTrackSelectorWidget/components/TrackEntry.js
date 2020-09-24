import React, { useState } from 'react'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { Menu } from '@gmod/jbrowse-core/ui'
import { getSession } from '@gmod/jbrowse-core/util'
import Checkbox from '@material-ui/core/Checkbox'
import Fade from '@material-ui/core/Fade'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import SettingsIcon from '@material-ui/icons/Settings'
import HorizontalDots from '@material-ui/icons/MoreHoriz'
import CopyIcon from '@material-ui/icons/FileCopy'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import propTypes from 'prop-types'

const useStyles = makeStyles(theme => ({
  formControlLabel: {
    marginLeft: 0,
    '&:hover': {
      textDecoration: 'none',
      backgroundColor: fade(
        theme.palette.text.primary,
        theme.palette.action.hoverOpacity,
      ),
      // Reset on touch devices, it doesn't add specificity
      '@media (hover: none)': {
        backgroundColor: 'transparent',
      },
    },
    flexGrow: 1,
  },
  checkbox: {
    padding: 0,
  },
  track: {
    display: 'flex',
    flexDirection: 'row',
  },
  configureButton: {
    padding: 2,
  },
}))

function TrackEntry({ model, disabled, trackConf, assemblyName }) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = useState(null)
  const session = getSession(model)
  const titleText = assemblyName
    ? `The reference sequence for ${assemblyName}`
    : readConfObject(trackConf, 'description')
  const unsupported =
    readConfObject(trackConf, 'name') &&
    (readConfObject(trackConf, 'name').endsWith('(Unsupported)') ||
      readConfObject(trackConf, 'name').endsWith('(Unknown)'))
  const trackConfigId = readConfObject(trackConf, 'trackId')
  return (
    <Fade in>
      <div className={classes.track}>
        <Tooltip title={titleText} placement="left" enterDelay={500}>
          <FormControlLabel
            className={classes.formControlLabel}
            control={
              <Checkbox
                inputProps={{
                  'data-testid': `htsTrackEntry-${trackConfigId}`,
                }}
                className={classes.checkbox}
              />
            }
            label={
              assemblyName
                ? `Reference Sequence (${assemblyName})`
                : readConfObject(trackConf, 'name')
            }
            checked={model.view.tracks.some(t => t.configuration === trackConf)}
            onChange={() => model.view.toggleTrack(trackConf)}
            disabled={disabled || unsupported}
          />
        </Tooltip>
        <IconButton
          className={classes.configureButton}
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
          color="secondary"
          data-testid={`htsTrackEntryMenu-${trackConfigId}`}
        >
          <HorizontalDots fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchorEl}
          onMenuItemClick={(_, callback) => {
            callback()
            setAnchorEl(null)
          }}
          open={Boolean(anchorEl)}
          onClose={() => {
            setAnchorEl(null)
          }}
          menuItems={[
            {
              label: 'Settings',
              disabled: !(session.adminMode || trackConf.sessionTrack),
              onClick: () => {
                session.editTrackConfiguration(trackConf)
              },
              icon: SettingsIcon,
            },
            {
              label: 'Delete track',
              disabled: !(session.adminMode || trackConf.sessionTrack),
              onClick: () => {
                session.deleteTrackConf(trackConf)
              },
              icon: SettingsIcon,
            },
            {
              label: 'Copy track',
              onClick: () => {
                const trackSnapshot = JSON.parse(
                  JSON.stringify(getSnapshot(trackConf)),
                )
                trackSnapshot.trackId += `-${Date.now()}`
                trackSnapshot.name += ' (copy)'
                trackSnapshot.category = [' Session tracks']
                session.addTrackConf(trackSnapshot)
              },
              icon: CopyIcon,
            },
          ]}
        />
      </div>
    </Fade>
  )
}

TrackEntry.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  disabled: propTypes.bool,
  trackConf: MobxPropTypes.objectOrObservableObject.isRequired,
  assemblyName: propTypes.string,
}

TrackEntry.defaultProps = {
  disabled: false,
  assemblyName: null,
}

export default observer(TrackEntry)
