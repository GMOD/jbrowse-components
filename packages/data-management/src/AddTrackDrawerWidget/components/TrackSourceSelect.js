import { FileSelector } from '@gmod/jbrowse-core/ui'
import { JsonEditor } from '@gmod/jbrowse-plugin-config'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Paper from '@material-ui/core/Paper'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import PropTypes from 'prop-types'
import React from 'react'

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

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  paper: {
    padding: theme.spacing(1),
  },
}))

function getInputComponent(trackSource, trackData, setTrackData) {
  // mock the slots so we can use the slotEditor components here
  switch (trackSource) {
    case 'fromFile':
      return (
        <FileSelector
          name="dataSourceLocation"
          description=""
          location={trackData}
          setLocation={setTrackData}
        />
      )
    case 'fromConfig':
      return (
        <JsonEditor
          slot={{
            name: 'track data',
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

function TrackSourceSelect({
  trackSource,
  setTrackSource,
  trackData,
  setTrackData,
}) {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <FormControl component="fieldset">
        <RadioGroup
          aria-label="Data location"
          value={trackSource}
          onChange={event => handleChange(event, setTrackSource, setTrackData)}
          name="TrackSourceSelectRadioGroup"
        >
          <FormControlLabel
            value="fromFile"
            control={
              <Radio inputProps={{ 'data-testid': 'addTrackFromFileRadio' }} />
            }
            label="Enter data source"
          />
          <FormControlLabel
            value="fromConfig"
            control={
              <Radio
                inputProps={{ 'data-testid': 'addTrackFromConfigRadio' }}
              />
            }
            label="Enter data manually"
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
}

export default TrackSourceSelect
