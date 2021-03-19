import React, { useState } from 'react'
import { readConfObject } from '@jbrowse/core/configuration'
import { getSession } from '@jbrowse/core/util'
import { Menu } from '@jbrowse/core/ui'
import Checkbox from '@material-ui/core/Checkbox'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import IconButton from '@material-ui/core/IconButton'
import { makeStyles } from '@material-ui/core/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import HorizontalDots from '@material-ui/icons/MoreHoriz'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
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
    wordBreak: 'break-all',
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
  const trackName = readConfObject(trackConf, 'name')
  const trackId = readConfObject(trackConf, 'trackId')
  const unsupported =
    trackName &&
    (trackName.endsWith('(Unsupported)') || trackName.endsWith('(Unknown)'))
  const menuItems = session.getTrackActionMenuItems
    ? session.getTrackActionMenuItems(trackConf)
    : []

  return (
    <div className={classes.track}>
      <Tooltip title={titleText} placement="left" enterDelay={500}>
        <FormControlLabel
          className={classes.formControlLabel}
          control={
            <Checkbox
              inputProps={{
                'data-testid': `htsTrackEntry-${trackId}`,
              }}
              className={classes.checkbox}
            />
          }
          label={
            assemblyName ? `Reference Sequence (${assemblyName})` : trackName
          }
          checked={model.view.tracks.some(t => t.configuration === trackConf)}
          onChange={() => model.view.toggleTrack(trackConf.trackId)}
          disabled={disabled || unsupported}
        />
      </Tooltip>
      {menuItems.length ? (
        <IconButton
          className={classes.configureButton}
          onClick={event => {
            setAnchorEl(event.currentTarget)
          }}
          color="secondary"
          data-testid={`htsTrackEntryMenu-${trackId}`}
        >
          <HorizontalDots />
        </IconButton>
      ) : null}
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
        menuItems={menuItems}
      />
    </div>
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
