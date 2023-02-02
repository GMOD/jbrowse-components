import React, { useMemo, useState } from 'react'
import { Button, Step, StepContent, StepLabel, Stepper } from '@mui/material'
import { getSession, getEnv } from '@jbrowse/core/util'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

// locals
import ConfigureConnection from './ConfigureConnection'
import ConnectionTypeSelect from './ConnectionTypeSelect'
import { isSessionWithConnections } from '@jbrowse/product-core'

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
  const [connectionId, setConnectionId] = useState<string>()
  const [step, setStep] = useState(0)
  const session = getSession(model)
  const { classes } = useStyles()
  const { pluginManager } = getEnv(session)

  // useMemo is needed for react@18+mobx-react@9, previous code called configScema.create directly in a setConfigModel useState hook setter but this caused infinite loop
  const configModel = useMemo(
    () => connectionType?.configSchema.create({ connectionId }, getEnv(model)),
    [connectionId, connectionType, model],
  )

  return (
    <div className={classes.root}>
      <Stepper
        className={classes.stepper}
        activeStep={step}
        orientation="vertical"
      >
        {steps.map(label => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {step === 0 ? (
                <ConnectionTypeSelect
                  connectionTypeChoices={pluginManager.getConnectionElements()}
                  connectionType={connectionType}
                  setConnectionType={c => {
                    setConnectionType(c)
                    if (!c) {
                      return
                    }
                    setConnectionId(`${c.name}-${Date.now()}`)
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
                  disabled={step === 0}
                  onClick={() => setStep(step - 1)}
                  className={classes.button}
                >
                  Back
                </Button>
                <Button
                  disabled={
                    !(
                      (step === 0 && connectionType) ||
                      (step === 1 && configModel)
                    )
                  }
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    if (step === steps.length - 1) {
                      if (configModel && isSessionWithConnections(session)) {
                        session.makeConnection(
                          session.addConnectionConf(configModel),
                        )
                      } else {
                        session.notify('No config model to add')
                      }

                      session.hideWidget(model)
                    } else {
                      setStep(step + 1)
                    }
                  }}
                  className={classes.button}
                  data-testid="addConnectionNext"
                >
                  {step === steps.length - 1 ? 'Connect' : 'Next'}
                </Button>
              </div>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </div>
  )
})
