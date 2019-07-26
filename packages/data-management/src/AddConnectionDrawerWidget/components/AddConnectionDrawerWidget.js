import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React, { useState } from 'react'
import ConfigureConnection from './ConfigureConnection'
import ConnectionTypeSelect from './ConnectionTypeSelect'

const styles = theme => ({
  root: {
    marginTop: theme.spacing(1),
  },
  stepper: {
    backgroundColor: theme.palette.background.default,
  },
  button: {
    marginTop: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  actionsContainer: {
    marginBottom: theme.spacing(2),
  },
})

const steps = ['Select a Connection Type', 'Configure Connection']

function AddConnectionDrawerWidget(props) {
  const [connectionType, setConnectionType] = useState({})
  const [configModel, setConfigModel] = useState({})
  const [datasetName, setDatasetName] = useState('')

  const [activeStep, setActiveStep] = useState(0)

  const { classes, model } = props
  const session = getSession(model)

  const { pluginManager } = session

  function handleSetConnectionType(newConnectionType) {
    setConnectionType(newConnectionType)
    setConfigModel(newConnectionType.configSchema.create())
  }

  function stepContent() {
    switch (activeStep) {
      case 0:
        return (
          <ConnectionTypeSelect
            connectionTypeChoices={pluginManager.getElementTypesInGroup(
              'connection',
            )}
            connectionType={connectionType}
            setConnectionType={handleSetConnectionType}
            datasetNameChoices={session.datasets.map(dataset =>
              readConfObject(dataset, 'name'),
            )}
            datasetName={datasetName}
            setDatasetName={setDatasetName}
          />
        )
      case 1:
        return (
          <ConfigureConnection
            connectionType={connectionType}
            model={configModel}
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
    setActiveStep(activeStep - 1)
  }

  function handleFinish() {
    session.datasets
      .find(dataset => readConfObject(dataset, 'name') === datasetName)
      .addConnectionConf(configModel)
    session.hideDrawerWidget(model)
  }

  function checkNextEnabled() {
    if (
      (activeStep === 0 && connectionType.name) ||
      (activeStep === 1 && configModel)
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
        {steps.map(label => (
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
                  disabled={!checkNextEnabled()}
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  className={classes.button}
                  data-testid="addConnectionNext"
                >
                  {activeStep === steps.length - 1 ? 'Connect' : 'Next'}
                </Button>
              </div>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </div>
  )
}

AddConnectionDrawerWidget.propTypes = {
  classes: propTypes.objectOf(propTypes.string).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(AddConnectionDrawerWidget))
