import React, { useState } from 'react'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

// locals
import ConfigureConnection from './ConfigureConnection'
import ConnectionTypeSelect from './ConnectionTypeSelect'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'

const useStyles = makeStyles()(theme => ({
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
}))

const steps = ['Select a Connection Type', 'Configure Connection']

function AddConnectionWidget({ model }: { model: unknown }) {
  const [connectionType, setConnectionType] = useState<ConnectionType>()
  const [configModel, setConfigModel] = useState<AnyConfigurationModel>()
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()

  const session = getSession(model)

  const { pluginManager } = getEnv(session)

  function stepContent() {
    switch (activeStep) {
      case 0:
        return (
          <ConnectionTypeSelect
            connectionTypeChoices={pluginManager.getElementTypesInGroup(
              'connection',
            )}
            connectionType={connectionType}
            setConnectionType={c => {
              setConnectionType(c)
              if (c) {
                setConfigModel(
                  c.configSchema.create(
                    {
                      connectionId: `${c.name}-${Date.now()}`,
                    },
                    getEnv(model),
                  ),
                )
              }
            }}
          />
        )
      case 1:
        return connectionType && configModel ? (
          <ConfigureConnection
            connectionType={connectionType}
            model={configModel}
            session={session}
          />
        ) : null

      default:
        return <Typography>Unknown step</Typography>
    }
  }

  function handleNext() {
    if (activeStep === steps.length - 1) {
      handleFinish()
    } else {
      setActiveStep(activeStep + 1)
    }
  }

  function handleBack() {
    setActiveStep(activeStep - 1)
  }

  function handleFinish() {
    const connectionConf = session.addConnectionConf(configModel)
    if (session.makeConnection) {
      session.makeConnection(connectionConf)
    }
    session.hideWidget(model)
  }

  function checkNextEnabled() {
    return (
      (activeStep === 0 && connectionType) || (activeStep === 1 && configModel)
    )
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

export default observer(AddConnectionWidget)
