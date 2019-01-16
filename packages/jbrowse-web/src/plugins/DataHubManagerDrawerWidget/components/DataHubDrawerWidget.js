import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { inject, observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { applySnapshot, getSnapshot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React from 'react'
import ConfirmationDialog from './ConfirmationDialog'
import HubSourceSelect from './HubSourceSelect'
import HubTypeSelect from './HubTypeSelect'
import TrackHubRegistrySelect from './TrackHubRegistrySelect'
import UrlInput from './UrlInput'

const styles = theme => ({
  root: {
    marginTop: theme.spacing.unit,
  },
  stepper: {
    backgroundColor: theme.palette.background.default,
  },
  button: {
    marginTop: theme.spacing.unit,
    marginRight: theme.spacing.unit,
  },
  actionsContainer: {
    marginBottom: theme.spacing.unit * 2,
  },
})

const steps = [
  'Select a Data Hub Type',
  'Select a Data Hub Source',
  'Select a Data Hub',
  'Confirm Selection',
]

@withStyles(styles)
@inject('rootModel')
@observer
class DataHubDrawerWidget extends React.Component {
  static propTypes = {
    classes: propTypes.shape({
      root: propTypes.string.isRequired,
      stepper: propTypes.string.isRequired,
      button: propTypes.string.isRequired,
      actionsContainer: propTypes.string.isRequired,
    }).isRequired,
    rootModel: MobxPropTypes.observableObject.isRequired,
  }

  state = {
    // Step 0
    hubType: null, // ucsc, jbrowse1
    // Step 1
    hubSource: null, // trackHubRegistry, ucscCustom, jbrowseRegistry, jbrowseCustom
    // Step 2
    trackDbUrl: '',
    hubName: '',
    assemblyName: '',
    // Step 3
    // eslint-disable-next-line react/no-unused-state
    backupRootModel: null,

    activeStep: 0,
    nextEnabledThroughStep: -1,
  }

  setHubType = event => this.setState({ hubType: event.target.value })

  setHubSource = event => this.setState({ hubSource: event.target.value })

  setTrackDbUrl = newUrl => this.setState({ trackDbUrl: newUrl })

  setHubName = newHubName => this.setState({ hubName: newHubName })

  setAssemblyName = newAssemblyName =>
    this.setState({ assemblyName: newAssemblyName })

  get stepContent() {
    const {
      activeStep,
      hubType,
      hubSource,
      trackDbUrl,
      hubName,
      assemblyName,
    } = this.state
    let StepComponent
    switch (activeStep) {
      case 0:
        return (
          <HubTypeSelect
            hubType={hubType}
            setHubType={this.setHubType}
            enableNext={() => this.enableNextThrough(activeStep)}
          />
        )
      case 1:
        return (
          <HubSourceSelect
            hubType={hubType}
            hubSource={hubSource}
            setHubSource={this.setHubSource}
            enableNext={() => this.enableNextThrough(activeStep)}
          />
        )
      case 2:
        if (hubSource === 'ucscCustom') StepComponent = UrlInput
        else if (hubSource === 'trackHubRegistry')
          StepComponent = TrackHubRegistrySelect
        else
          return <Typography color="error">Unknown Data Hub Source</Typography>
        return (
          <StepComponent
            enableNext={() => this.enableNextThrough(activeStep)}
            disableNext={() => this.enableNextThrough(activeStep - 1)}
            setTrackDbUrl={this.setTrackDbUrl}
            setHubName={this.setHubName}
            setAssemblyName={this.setAssemblyName}
          />
        )
      case 3:
        return (
          <ConfirmationDialog
            hubName={hubName}
            assemblyName={assemblyName}
            trackDbUrl={trackDbUrl}
            enableNext={() => this.enableNextThrough(activeStep)}
          />
        )
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  enableNextThrough = step => this.setState({ nextEnabledThroughStep: step })

  handleNext = () => {
    const { activeStep } = this.state
    const { rootModel } = this.props
    if (activeStep === steps.length - 1) {
      rootModel.hideAllDrawerWidgets()
      return
    }
    if (activeStep === steps.length - 2) {
      const backupRootModel = getSnapshot(rootModel)
      // eslint-disable-next-line react/no-unused-state
      this.setState({ backupRootModel })
    }
    this.setState(state => ({
      activeStep: state.activeStep + 1,
    }))
  }

  handleBack = () => {
    this.setState((state, props) => {
      let { hubSource, backupRootModel } = state
      const { rootModel } = props
      const { activeStep } = state
      if (activeStep === steps.length - 1) {
        applySnapshot(rootModel, backupRootModel)
        backupRootModel = null
      }
      const newStep = activeStep - 1
      if (newStep < 1) hubSource = null
      return {
        activeStep: newStep,
        nextEnabledThroughStep: newStep,
        hubSource,
        backupRootModel,
      }
    })
  }

  render() {
    const { classes } = this.props
    const { activeStep, nextEnabledThroughStep } = this.state

    return (
      <div className={classes.root}>
        <Stepper
          className={classes.stepper}
          activeStep={activeStep}
          orientation="vertical"
        >
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
              <StepContent>
                {this.stepContent}
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
      </div>
    )
  }
}

export default DataHubDrawerWidget
