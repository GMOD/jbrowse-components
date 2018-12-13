import Button from '@material-ui/core/Button'
import FormControl from '@material-ui/core/FormControl'
import FormControlLabel from '@material-ui/core/FormControlLabel'
import FormHelperText from '@material-ui/core/FormHelperText'
import Paper from '@material-ui/core/Paper'
import Radio from '@material-ui/core/Radio'
import RadioGroup from '@material-ui/core/RadioGroup'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import propTypes from 'prop-types'
import React from 'react'
import TrackHubRegistrySelect from './TrackHubRegistrySelect'

const styles = theme => ({
  root: {
    'margin-top': theme.spacing.unit,
  },
  button: {
    marginTop: theme.spacing.unit,
    marginRight: theme.spacing.unit,
  },
  actionsContainer: {
    marginBottom: theme.spacing.unit * 2,
  },
  resetContainer: {
    padding: theme.spacing.unit * 3,
  },
})

const steps = [
  'Select a Data Hub Type',
  'Select a Data Hub Source',
  'Select a Data Hub',
  'Confirm Selection',
]

const hubTypeDescriptions = {
  ucsc: (
    <FormHelperText>
      A track or assembly hub in the{' '}
      <a
        href="http://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro"
        rel="noopener noreferrer"
        target="_blank"
      >
        Track Hub
      </a>{' '}
      format
    </FormHelperText>
  ),
  jbrowse1: (
    <FormHelperText>
      A{' '}
      <a href="https://jbrowse.org/" rel="noopener noreferrer" target="_blank">
        JBrowse 1
      </a>{' '}
      data directory
    </FormHelperText>
  ),
}

const hubSourceDescriptions = {
  trackhubregistry: (
    <FormHelperText>
      Search{' '}
      <a
        href="https://trackhubregistry.org/"
        rel="noopener noreferrer"
        target="_blank"
      >
        The Track Hub Registry
      </a>
    </FormHelperText>
  ),
  ucsccustom: <FormHelperText>User-provided track hub URL</FormHelperText>,
  jbrowseregistry: (
    <FormHelperText>As-yet-unimplemented JBrowse data registry</FormHelperText>
  ),
  jbrowsecustom: (
    <FormHelperText>User-provided JBrowse 1 data directory URL</FormHelperText>
  ),
}

function HubTypeSelector(props) {
  const { hubType, setHubType } = props
  const hubTypes = [
    { value: 'ucsc', label: 'Track or Assembly Hub' },
    { value: 'jbrowse1', label: 'JBrowse Hub' },
  ]
  return (
    <FormControl component="fieldset">
      <RadioGroup value={hubType} onChange={setHubType}>
        {hubTypes.map(entry => (
          <FormControlLabel
            key={entry.value}
            control={<Radio />}
            value={entry.value}
            label={entry.label}
          />
        ))}
      </RadioGroup>
      {hubTypeDescriptions[hubType]}
    </FormControl>
  )
}

HubTypeSelector.defaultProps = {
  hubType: undefined,
}

HubTypeSelector.propTypes = {
  hubType: propTypes.string,
  setHubType: propTypes.func.isRequired,
}

function HubSourceSelector(props) {
  const { hubSource, setHubSource, hubType } = props
  let hubSources = []
  if (hubType === 'ucsc')
    hubSources = [
      { value: 'trackhubregistry', label: 'The Track Hub Registry' },
      { value: 'ucsccustom', label: 'Track Hub URL' },
    ]
  return (
    <FormControl component="fieldset">
      <RadioGroup value={hubSource} onChange={setHubSource}>
        {hubSources.map(entry => (
          <FormControlLabel
            key={entry.value}
            control={<Radio />}
            value={entry.value}
            label={entry.label}
          />
        ))}
      </RadioGroup>
      {hubSourceDescriptions[hubSource]}
    </FormControl>
  )
}

HubSourceSelector.defaultProps = {
  hubSource: undefined,
  hubType: undefined,
}

HubSourceSelector.propTypes = {
  hubSource: propTypes.string,
  hubType: propTypes.string,
  setHubSource: propTypes.func.isRequired,
}

function HubSelector(props) {
  const { hubType } = props
  switch (hubType) {
    case 'ucsc':
      return <Typography>Some UCSC Hubs</Typography>
    case 'jbrowse1':
      return (
        <Typography>
          Adding JBrowse hubs has not yet been implemented
        </Typography>
      )
    default:
      return <Typography>Unknown hub type</Typography>
  }
}

function getStepContent(step, hubType, setHubType, hubSource, setHubSource) {
  switch (step) {
    case 0:
      return <HubTypeSelector hubType={hubType} setHubType={setHubType} />
    case 1:
      return (
        <HubSourceSelector
          hubType={hubType}
          hubSource={hubSource}
          setHubSource={setHubSource}
        />
      )
    case 2:
      return <TrackHubRegistrySelect />
    // return <HubSelector hubType={hubType} />
    case 3:
      return <Typography>Confimation dialog</Typography>
    default:
      return <Typography>Unknown step</Typography>
  }
}

class DataHubDrawerWidget extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
      button: propTypes.string.isRequired,
      actionsContainer: propTypes.string.isRequired,
      resetContainer: propTypes.string.isRequired,
    }).isRequired,
  }

  state = {
    activeStep: 0,
    hubSource: undefined,
    hubType: undefined,
  }

  handleNext = () => {
    this.setState(state => ({
      activeStep: state.activeStep + 1,
    }))
  }

  handleBack = () => {
    this.setState(state => ({
      activeStep: state.activeStep - 1,
    }))
  }

  handleReset = () => {
    this.setState({
      activeStep: 0,
    })
  }

  setHubType = event => {
    this.setState({ hubType: event.target.value })
  }

  setHubSource = event => {
    this.setState({ hubSource: event.target.value })
  }

  isNextDisabled = () => {
    const { activeStep, hubType } = this.state
    switch (activeStep) {
      case 0:
        return !hubType
      case 1:
        if (hubType === 'ucsc') return false
        return true
      case 2:
        return false
      default:
        return true
    }
  }

  render() {
    const { classes } = this.props
    const { activeStep, hubSource, hubType } = this.state

    return (
      <div className={classes.root}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel
                StepIconProps={{
                  error: index === 2 && activeStep === 2 && hubType !== 'ucsc',
                }}
              >
                {label}
              </StepLabel>
              <StepContent>
                {getStepContent(
                  index,
                  hubType,
                  this.setHubType,
                  hubSource,
                  this.setHubSource,
                )}
                <div className={classes.actionsContainer}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={this.handleBack}
                    className={classes.button}
                  >
                    Back
                  </Button>
                  <Button
                    disabled={this.isNextDisabled()}
                    variant="contained"
                    color="primary"
                    onClick={this.handleNext}
                    className={classes.button}
                  >
                    {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                  </Button>
                </div>
              </StepContent>
            </Step>
          ))}
        </Stepper>
        {activeStep === steps.length && (
          <Paper square elevation={0} className={classes.resetContainer}>
            <Typography>All steps completed - you&apos;re finished</Typography>
            <Button onClick={this.handleReset} className={classes.button}>
              Reset
            </Button>
          </Paper>
        )}
      </div>
    )
  }
}

export default withStyles(styles)(DataHubDrawerWidget)
