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

const styles = theme => ({
  root: {
    width: '90%',
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
  'Select a Data Hub',
  'Confirm Selection',
]

const dataHubDescriptions = {
  ucsc: (
    <div>
      A track or assembly hub in the{' '}
      <a
        href="http://genome.ucsc.edu/goldenPath/help/hgTrackHubHelp.html#Intro"
        rel="noopener noreferrer"
        target="_blank"
      >
        Track Hub
      </a>{' '}
      format
    </div>
  ),
  jbrowse1: (
    <div>
      A{' '}
      <a href="https://jbrowse.org/" rel="noopener noreferrer" target="_blank">
        JBrowse 1
      </a>{' '}
      data directory
    </div>
  ),
}

function HubTypeSelector(props) {
  const { hubType, handleStateSelect } = props
  return (
    <FormControl component="fieldset">
      <RadioGroup value={hubType} onChange={handleStateSelect}>
        <FormControlLabel
          value="ucsc"
          control={<Radio />}
          label="Track or Assembly Hub"
        />
        <FormControlLabel
          value="jbrowse1"
          control={<Radio />}
          label="JBrowse Hub"
        />
      </RadioGroup>
      <FormHelperText>{dataHubDescriptions[hubType]}</FormHelperText>
    </FormControl>
  )
}

HubTypeSelector.propTypes = {
  hubType: propTypes.string.isRequired,
  handleStateSelect: propTypes.func.isRequired,
}

function getStepContent(step, hubType, handleStateSelect) {
  switch (step) {
    case 0:
      return (
        <HubTypeSelector
          hubType={hubType}
          handleStateSelect={handleStateSelect}
        />
      )
    case 1:
      return <Typography>List of known data hubs of selected type</Typography>
    case 2:
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

  handleHubSelect = event => {
    this.setState({ hubType: event.target.value })
  }

  render() {
    const { classes } = this.props
    const { activeStep, hubType } = this.state

    return (
      <div className={classes.root}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {getStepContent(index, hubType, this.handleHubSelect)}
                <div className={classes.actionsContainer}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={this.handleBack}
                    className={classes.button}
                  >
                    Back
                  </Button>
                  <Button
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
