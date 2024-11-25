import React, { useMemo, useState } from 'react'
import {
  getSession,
  getEnv,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { isSessionWithConnections } from '@jbrowse/product-core'
import { Button, Step, StepContent, StepLabel, Stepper } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import ConfigureConnection from './ConfigureConnection'
import ConnectionTypeSelect from './ConnectionTypeSelect'
import type { ConnectionType } from '@jbrowse/core/pluggableElementTypes'

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

const AddConnectionWidget = observer(function ({ model }: { model: unknown }) {
  const [connectionType, setConnectionType] = useState<ConnectionType>()
  const [connectionId, setConnectionId] = useState<string>()
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()
  const session = getSession(model)
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
                  disabled={activeStep === 0}
                  onClick={() => {
                    setActiveStep(activeStep - 1)
                  }}
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
                      if (configModel && isSessionWithConnections(session)) {
                        const conf = session.addConnectionConf(configModel)
                        session.makeConnection(conf)
                      } else {
                        session.notify('No config model to add')
                      }

                      if (isSessionModelWithWidgets(session)) {
                        session.hideWidget(model)
                      }
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

export default AddConnectionWidget
