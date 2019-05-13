import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import { getRoot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React, { useState } from 'react'
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
]

function DataHubDrawerWidget(props) {
  // Step 0
  const [hubType, setHubType] = useState('') // ucsc, jbrowse1
  // Step 1
  const [hubSource, setHubSource] = useState('') // trackHubRegistry, ucscCustom, jbrowseRegistry, jbrowseCustom
  // Step 2
  const [hubName, setHubName] = useState('')
  const [hubUrl, setHubUrl] = useState('')
  const [assemblyNames, setAssemblyNames] = useState([])

  const [activeStep, setActiveStep] = useState(0)

  const { classes, model } = props
  const rootModel = getRoot(model)

  function stepContent(currStep) {
    let StepComponent
    switch (currStep) {
      case 0:
        return (
          <HubTypeSelect
            hubType={hubType}
            setHubType={event => setHubType(event.target.value)}
          />
        )
      case 1:
        return (
          <HubSourceSelect
            hubType={hubType}
            hubSource={hubSource}
            setHubSource={event => setHubSource(event.target.value)}
          />
        )
      case 2:
        if (hubSource === 'ucscCustom') {
          StepComponent = UrlInput
        } else if (hubSource === 'trackHubRegistry') {
          StepComponent = TrackHubRegistrySelect
        } else {
          return <Typography color="error">Unknown Data Hub Source</Typography>
        }
        return (
          <StepComponent
            setHubName={setHubName}
            hubUrl={hubUrl}
            setHubUrl={setHubUrl}
            assemblyNames={assemblyNames}
            setAssemblyNames={setAssemblyNames}
          />
        )
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  function handleNext() {
    if (activeStep === steps.length - 1) handleFinish()
    else setActiveStep(activeStep + 1)
  }

  function handleBack() {
    const newStep = activeStep - 1
    let newHubSource = hubSource
    if (newStep < 1) newHubSource = null
    setActiveStep(newStep)
    setHubSource(newHubSource)
  }

  function handleFinish() {
    const connectionType = hubType === 'ucsc' ? 'trackHub' : ''
    rootModel.configuration.addConnection({
      connectionName: hubName,
      connectionType,
      connectionLocation: { uri: hubUrl },
      connectionOptions: { assemblyNames },
    })
    rootModel.hideDrawerWidget(
      rootModel.drawerWidgets.get('dataHubDrawerWidget'),
    )
  }

  function checkNextEnabled() {
    if (
      (activeStep === 0 && hubType) ||
      (activeStep === 1 && hubSource) ||
      (activeStep === 2 && assemblyNames.length)
    )
      return true
    return false
  }

  return (
    <div className={classes.root}>
      <Stepper
        className={classes.stepper}
        activeStep={activeStep}
        orientation="vertical"
      >
        {steps.map((label, i) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {stepContent(i)}
              <div className={classes.actionsContainer}>
                <Button
                  disabled={activeStep === 0}
                  onClick={handleBack}
                  className={classes.button}
                >
                  Back
                </Button>
                <Button
                  disabled={!checkNextEnabled()}
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  className={classes.button}
                  data-testid={`dataHubNext${
                    activeStep === i ? '-current' : ''
                  }`}
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
  classes: propTypes.objectOf(propTypes.string).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(DataHubDrawerWidget))
