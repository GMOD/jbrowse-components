import { Paper } from '@material-ui/core'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { onPatch } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
import { ConfigurationSchema } from '../../../configuration'
import JsonEditor from '../../ConfigurationEditorDrawerWidget/components/JsonEditor'
import { FileLocationEditor } from '../../ConfigurationEditorDrawerWidget/components/SlotEditor'

const fromConfigDefault = [
  {
    uniqueId: 'one',
    seq_id: 'chr1',
    start: 100,
    end: 101,
  },
  {
    uniqueId: 'two',
    seq_id: 'chr1',
    start: 110,
    end: 111,
  },
  {
    uniqueId: 'three',
    seq_id: 'chr1',
    start: 120,
    end: 121,
  },
  {
    uniqueId: 'four',
    seq_id: 'chr1',
    start: 130,
    end: 131,
  },
]
const FromConfigSchema = ConfigurationSchema('FromConfig', {
  configuration: {
    description: 'A JSON representation of the features in the track',
    type: 'frozen',
    defaultValue: fromConfigDefault,
  },
})
const fromConfig = FromConfigSchema.create()

const fromFileDefault = { uri: '' }
const FromFileSchema = ConfigurationSchema('FromFile', {
  fileLocation: {
    type: 'fileLocation',
    defaultValue: fromFileDefault,
  },
})
const fromFile = FromFileSchema.create()

const styles = theme => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  paper: {
    padding: theme.spacing.unit,
  },
})

@withStyles(styles)
class TrackSourceSelect extends React.Component {
  static propTypes = {
    updateTrackData: PropTypes.func.isRequired,
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
  }

  state = {
    value: 'fromFile',
  }

  componentDidMount() {
    const { updateTrackData } = this.props
    onPatch(fromFile, patch => {
      if (patch.path === '/fileLocation/value/uri')
        updateTrackData({ uri: patch.value })
      else if (patch.path === '/fileLocation/value/localPath')
        updateTrackData({ localPath: patch.value })
    })
    onPatch(fromConfig, patch => updateTrackData({ config: patch.value }))
  }

  getInputComponent(value) {
    switch (value) {
      case 'fromFile':
        return <FileLocationEditor slot={fromFile.fileLocation} />
      case 'fromConfig':
        return <JsonEditor slot={fromConfig.configuration} />
      default:
        return <Typography>Unknown track source</Typography>
    }
  }

  handleChange = event => {
    const { updateTrackData } = this.props
    this.setState({ value: event.target.value })
    switch (event.target.value) {
      case 'fromFile':
        fromFile.fileLocation.set(fromFileDefault)
        updateTrackData(fromFileDefault)
        break
      case 'fromConfig':
        fromConfig.configuration.set(fromConfigDefault)
        updateTrackData({ config: fromConfigDefault })
        break
      default:
        break
    }
  }

  render() {
    const { value } = this.state
    const { classes } = this.props
    return (
      <div className={classes.root}>
        <FormControl component="fieldset">
          <RadioGroup
            aria-label="Data location"
            value={value}
            onChange={this.handleChange}
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
        <Paper className={classes.paper}>{this.getInputComponent(value)}</Paper>
      </div>
    )
  }
}

export default TrackSourceSelect
