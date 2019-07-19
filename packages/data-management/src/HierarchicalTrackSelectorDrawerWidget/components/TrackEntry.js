import { getSession } from '@gmod/jbrowse-core/util'
import Checkbox from '@material-ui/core/Checkbox'
import Fade from '@material-ui/core/Fade'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import { withStyles } from '@material-ui/styles'
import { fade } from '@material-ui/core/styles/colorManipulator'
import Tooltip from '@material-ui/core/Tooltip'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React from 'react'
import { readConfObject } from '@gmod/jbrowse-core/configuration'

const styles = theme => ({
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
})

function TrackEntry(props) {
  const { model, disabled, trackConf, assemblyName, classes } = props
  const session = getSession(model)
  const titleText = assemblyName
    ? `The reference sequence for ${assemblyName}`
    : readConfObject(trackConf, 'description')
  const unsupported =
    readConfObject(trackConf, 'name') &&
    readConfObject(trackConf, 'name').endsWith('(Unsupported)')
  return (
    <Fade in>
      <div className={classes.track}>
        <Tooltip title={titleText} placement="left" enterDelay={500}>
          <FormControlLabel
            className={classes.formControlLabel}
            control={
              <Checkbox
                inputProps={{
                  'data-testid': `htsTrackEntry-${trackConf.configId}`,
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
          onClick={() => session.editConfiguration(trackConf)}
        >
          <Icon fontSize="small">settings</Icon>
        </IconButton>
      </div>
    </Fade>
  )
}

TrackEntry.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
  disabled: propTypes.bool,
  trackConf: MobxPropTypes.objectOrObservableObject.isRequired,
  assemblyName: propTypes.string,
  classes: propTypes.objectOf(propTypes.string).isRequired,
}

TrackEntry.defaultProps = {
  disabled: false,
  assemblyName: null,
}

export default withStyles(styles)(observer(TrackEntry))
