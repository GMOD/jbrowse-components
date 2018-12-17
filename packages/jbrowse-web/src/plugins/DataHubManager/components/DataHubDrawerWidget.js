import Button from '@material-ui/core/Button'
import Paper from '@material-ui/core/Paper'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import propTypes from 'prop-types'
import React from 'react'
import HubSourceSelect from './HubSourceSelect'
import HubTypeSelect from './HubTypeSelect'
import TrackHubRegistrySelect from './TrackHubRegistrySelect'
import UrlInput from './UrlInput'

const styles = theme => ({
  root: {
    marginTop: theme.spacing.unit,
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
    nextEnabledThroughStep: -1,
  }

  getStepContent() {
    const { activeStep, hubType, hubSource } = this.state
    switch (activeStep) {
      case 0:
        return (
          <HubTypeSelect
            hubType={hubType}
            setHubType={this.setHubType}
            enableNext={() => {
              this.setState({ nextEnabledThroughStep: activeStep })
            }}
          />
        )
      case 1:
        return (
          <HubSourceSelect
            hubType={hubType}
            hubSource={hubSource}
            setHubSource={this.setHubSource}
            enableNext={() => {
              this.setState({ nextEnabledThroughStep: activeStep })
            }}
          />
        )
      case 2:
        if (hubSource === 'ucsccustom')
          return (
            <UrlInput
              enableNext={() => {
                this.setState({ nextEnabledThroughStep: activeStep })
              }}
              disableNext={() => {
                this.setState({ nextEnabledThroughStep: activeStep - 1 })
              }}
            />
          )
        if (hubSource === 'trackhubregistry') return <TrackHubRegistrySelect />
        return <Typography color="error">Unknown Data Hub Source</Typography>
      // return <HubSelector hubType={hubType} />
      case 3:
        return <Typography>Confimation dialog</Typography>
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  handleNext = () => {
    this.setState(state => ({
      activeStep: state.activeStep + 1,
    }))
  }

  handleBack = () => {
    this.setState(state => {
      let { hubSource } = state
      const { activeStep } = state
      const newStep = activeStep - 1
      if (newStep < 1) hubSource = null
      return {
        activeStep: newStep,
        nextEnabledThroughStep: newStep,
        hubSource,
      }
    })
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

  render() {
    const { classes } = this.props
    const {
      activeStep,
      hubSource,
      hubType,
      nextEnabledThroughStep,
    } = this.state

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
                {this.getStepContent()}
                <div className={classes.actionsContainer}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={this.handleBack}
                    className={classes.button}
                  >
                    Back
                  </Button>
                  <Button
                    disabled={index > nextEnabledThroughStep}
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
