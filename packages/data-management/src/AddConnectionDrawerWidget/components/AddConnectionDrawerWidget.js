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
import React, { useState, useEffect } from 'react'
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

  const [activeStep, setActiveStep] = useState(0)

  const { classes, model } = props
  const rootModel = getRoot(model)

  const { pluginManager } = rootModel

  function handleSetConnectionType(newConnectionType) {
    setConnectionType(newConnectionType)
    setConfigModel(newConnectionType.configSchema.create())
  }

  function stepContent(currStep) {
    switch (currStep) {
      case 0:
        return (
          <ConnectionTypeSelect
            connectionTypeChoices={pluginManager.getElementTypesInGroup(
              'connection',
            )}
            connectionType={connectionType}
            setConnectionType={handleSetConnectionType}
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

  useEffect(() => {
    if (activeStep === steps.length) {
      rootModel.configuration.addConnection(configModel)
      rootModel.hideDrawerWidget(
        rootModel.drawerWidgets.get('addConnectionDrawerWidget'),
      )
    }
  }, [rootModel, configModel, activeStep])

  return (
    <div className={classes.root}>
      <Stepper
        className={classes.stepper}
        activeStep={activeStep}
        orientation="vertical"
      >
        {steps.map((step, index) => (
          <Step key={step}>
            <StepLabel>{step}</StepLabel>
            <StepContent>
              {stepContent(index)}
              <div className={classes.actionsContainer}>
                <Button
                  disabled={index === 0}
                  onClick={() => setActiveStep(activeStep - 1)}
                  className={classes.button}
                >
                  Back
                </Button>
                <Button
                  disabled={
                    !(
                      (activeStep === 0 && connectionType.name) ||
                      (activeStep === 1 && configModel)
                    )
                  }
                  variant="contained"
                  color="primary"
                  onClick={() => setActiveStep(activeStep + 1)}
                  className={classes.button}
                  data-testid={
                    index === activeStep
                      ? 'addConnectionNext'
                      : 'addConnectionNext-notcurrent'
                  }
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
