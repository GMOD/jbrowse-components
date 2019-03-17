import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import { applySnapshot, getRoot, getSnapshot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React, { useState } from 'react'
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

function DataHubDrawerWidget(props) {
  // Step 0
  const [hubType, setHubType] = useState(null) // ucsc, jbrowse1
  // Step 1
  const [hubSource, setHubSource] = useState('') // trackHubRegistry, ucscCustom, jbrowseRegistry, jbrowseCustom
  // Step 2
  const [trackDbUrl, setTrackDbUrl] = useState('')
  const [hubName, setHubName] = useState('')
  const [assemblyName, setAssemblyName] = useState('')
  // Step 3
  // eslint-disable-next-line react/no-unused-state
  const [backupRootModel, setBackupRootModel] = useState(null)

  const [activeStep, setActiveStep] = useState(0)
  const [nextEnabledThroughStep, setNextEnabledThroughStep] = useState(-1)

  const { classes, model } = props
  const rootModel = getRoot(model)

  function stepContent() {
    let StepComponent
    switch (activeStep) {
      case 0:
        return (
          <HubTypeSelect
            hubType={hubType}
            setHubType={event => setHubType(event.target.value)}
            enableNext={() => setNextEnabledThroughStep(activeStep)}
          />
        )
      case 1:
        return (
          <HubSourceSelect
            hubType={hubType}
            hubSource={hubSource}
            setHubSource={event => setHubSource(event.target.value)}
            enableNext={() => setNextEnabledThroughStep(activeStep)}
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
            enableNext={() => setNextEnabledThroughStep(activeStep)}
            disableNext={() => setNextEnabledThroughStep(activeStep - 1)}
            setTrackDbUrl={setTrackDbUrl}
            setHubName={setHubName}
            setAssemblyName={setAssemblyName}
          />
        )
      case 3:
        return (
          <ConfirmationDialog
            hubName={hubName}
            assemblyName={assemblyName}
            trackDbUrl={trackDbUrl}
            enableNext={() => setNextEnabledThroughStep(activeStep)}
            rootModel={getRoot(model)}
          />
        )
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  function handleNext() {
    if (activeStep === steps.length - 1) {
      rootModel.hideAllDrawerWidgets()
      return
    }
    if (activeStep === steps.length - 2) {
      const newBackupRootModel = getSnapshot(rootModel)
      // eslint-disable-next-line react/no-unused-state
      setBackupRootModel(newBackupRootModel)
    }
    setActiveStep(activeStep + 1)
  }

  function handleBack() {
    let newBackupRootModel = backupRootModel
    if (activeStep === steps.length - 1) {
      applySnapshot(rootModel, backupRootModel)
      newBackupRootModel = null
    }
    const newStep = activeStep - 1
    let newHubSource = hubSource
    if (newStep < 1) newHubSource = null
    setActiveStep(newStep)
    setNextEnabledThroughStep(newStep)
    setHubSource(newHubSource)
    setBackupRootModel(newBackupRootModel)
  }

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
              {stepContent()}
              <div className={classes.actionsContainer}>
                <Button
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  className={classes.button}
                >
                  Back
                </Button>
                <Button
                  disabled={index > nextEnabledThroughStep}
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
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

DataHubDrawerWidget.propTypes = {
  classes: propTypes.shape({
    root: propTypes.string.isRequired,
    stepper: propTypes.string.isRequired,
    button: propTypes.string.isRequired,
    actionsContainer: propTypes.string.isRequired,
  }).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(DataHubDrawerWidget))
