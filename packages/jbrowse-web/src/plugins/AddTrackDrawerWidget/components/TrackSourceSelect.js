import { Paper } from '@material-ui/core'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'
import JsonEditor from '../../ConfigurationEditorDrawerWidget/components/JsonEditor'
import { FileLocationEditor } from '../../ConfigurationEditorDrawerWidget/components/SlotEditor'

const fromConfigDefault = [
  {
    uniqueId: 'one',
    refName: 'chr1',
    start: 100,
    end: 101,
  },
  {
    uniqueId: 'two',
    refName: 'chr1',
    start: 110,
    end: 111,
  },
  {
    uniqueId: 'three',
    refName: 'chr1',
    start: 120,
    end: 121,
  },
  {
    uniqueId: 'four',
    refName: 'chr1',
    start: 130,
    end: 131,
  },
]

const fromFileDefault = { uri: '' }

const styles = theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  paper: {
    padding: theme.spacing.unit,
  },
})

function getInputComponent(trackSource, trackData, updateTrackData) {
  // mock the slots so we can use the slotEditor components here
  switch (trackSource) {
    case 'fromFile':
      return (
        <FileLocationEditor
          slot={{
            name: 'fileLocation',
            description: '',
            value: trackData,
            set: value => updateTrackData(value),
          }}
        />
      )
    case 'fromConfig':
      return (
        <JsonEditor
          slot={{
            name: 'configuration',
            description: 'A JSON representation of the features in the track',
            value: trackData.config,
            set: value => updateTrackData({ config: value }),
          }}
        />
      )
    default:
      return <Typography>Unknown track source</Typography>
  }
}

function handleChange(event, updateTrackSource, updateTrackData) {
  updateTrackSource(event.target.value)
  switch (event.target.value) {
    case 'fromFile':
      updateTrackData(fromFileDefault)
      break
    case 'fromConfig':
      updateTrackData({ config: fromConfigDefault })
      break
    default:
      break
  }
}

function TrackSourceSelect(props) {
  const {
    trackSource,
    updateTrackSource,
    trackData,
    updateTrackData,
    classes,
  } = props
  return (
    <div className={classes.root}>
      <FormControl component="fieldset">
        <RadioGroup
          aria-label="Data location"
          value={trackSource}
          onChange={event =>
            handleChange(event, updateTrackSource, updateTrackData)
          }
        >
          <FormControlLabel
            value="fromFile"
            control={<Radio />}
            label="From file"
          />
          <FormControlLabel
            value="fromConfig"
            control={<Radio />}
            label="From configuration"
          />
        </RadioGroup>
      </FormControl>
      <Paper className={classes.paper}>
        {getInputComponent(trackSource, trackData, updateTrackData)}
      </Paper>
    </div>
  )
}

TrackSourceSelect.propTypes = {
  trackSource: PropTypes.string.isRequired,
  updateTrackSource: PropTypes.func.isRequired,
  trackData: PropTypes.objectOf(PropTypes.any).isRequired,
  updateTrackData: PropTypes.func.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}

export default withStyles(styles)(TrackSourceSelect)
