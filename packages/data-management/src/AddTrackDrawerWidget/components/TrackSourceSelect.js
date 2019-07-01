import { Paper } from '@material-ui/core'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'
import { JsonEditor, FileLocationEditor } from '@gmod/jbrowse-plugin-config'

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
    padding: theme.spacing(1),
  },
})

function getInputComponent(trackSource, trackData, setTrackData) {
  // mock the slots so we can use the slotEditor components here
  switch (trackSource) {
    case 'fromFile':
      return (
        <FileLocationEditor
          slot={{
            name: 'fileLocation',
            description: '',
            value: trackData,
            set: value => setTrackData(value),
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
            set: value => setTrackData({ config: value }),
          }}
        />
      )
    default:
      return <Typography>Unknown track source</Typography>
  }
}

function handleChange(event, setTrackSource, setTrackData) {
  setTrackSource(event.target.value)
  switch (event.target.value) {
    case 'fromFile':
      setTrackData(fromFileDefault)
      break
    case 'fromConfig':
      setTrackData({ config: fromConfigDefault })
      break
    default:
      break
  }
}

function TrackSourceSelect(props) {
  const {
    trackSource,
    setTrackSource,
    trackData,
    setTrackData,
    classes,
  } = props
  return (
    <div className={classes.root}>
      <FormControl component="fieldset">
        <RadioGroup
          aria-label="Data location"
          value={trackSource}
          onChange={event => handleChange(event, setTrackSource, setTrackData)}
        >
          <FormControlLabel
            value="fromFile"
            control={
              <Radio inputProps={{ 'data-testid': 'addTrackFromFileRadio' }} />
            }
            label="From file"
          />
          <FormControlLabel
            value="fromConfig"
            control={
              <Radio
                inputProps={{ 'data-testid': 'addTrackFromConfigRadio' }}
              />
            }
            label="From configuration"
          />
        </RadioGroup>
      </FormControl>
      <Paper className={classes.paper}>
        {getInputComponent(trackSource, trackData, setTrackData)}
      </Paper>
    </div>
  )
}

TrackSourceSelect.propTypes = {
  trackSource: PropTypes.string.isRequired,
  setTrackSource: PropTypes.func.isRequired,
  trackData: PropTypes.objectOf(PropTypes.any).isRequired,
  setTrackData: PropTypes.func.isRequired,
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
}

export default withStyles(styles)(TrackSourceSelect)
