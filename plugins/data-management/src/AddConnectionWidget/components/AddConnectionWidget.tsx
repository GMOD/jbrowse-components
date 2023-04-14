import React, { useState } from 'react'
import { Button, Step, StepContent, StepLabel, Stepper } from '@mui/material'
import { getSession, getEnv } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration'
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

// locals
import ConfigureConnection from './ConfigureConnection'
import ConnectionTypeSelect from './ConnectionTypeSelect'

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

export default observer(function AddConnectionWidget({
  model,
}: {
  model: unknown
}) {
  const [connectionType, setConnectionType] = useState<ConnectionType>()
  const [configModel, setConfigModel] = useState<AnyConfigurationModel>()
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()
  const session = getSession(model)
  const { pluginManager } = getEnv(session)

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
              {activeStep === 0 ? (
                <ConnectionTypeSelect
                  connectionTypeChoices={pluginManager.getConnectionElements()}
                  connectionType={connectionType}
                  setConnectionType={c => {
                    setConnectionType(c)
                    if (!c) {
                      return
                    }
                    const connectionId = `${c.name}-${Date.now()}`
                    setConfigModel(
                      c.configSchema.create({ connectionId }, getEnv(model)),
                    )
                  }}
                />
              ) : connectionType && configModel ? (
                <ConfigureConnection
                  connectionType={connectionType}
                  model={configModel}
                  session={session}
                />
              ) : null}
              <div className={classes.actionsContainer}>
                <Button
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep(activeStep - 1)}
                  className={classes.button}
                >
                  Back
                </Button>
                <Button
                  disabled={
                    !(
                      (activeStep === 0 && connectionType) ||
                      (activeStep === 1 && configModel)
                    )
                  }
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    if (activeStep === steps.length - 1) {
                      const conf = session.addConnectionConf(configModel)
                      session.makeConnection?.(conf)
                      session.hideWidget(model)
                    } else {
                      setActiveStep(activeStep + 1)
                    }
                  }}
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
})
