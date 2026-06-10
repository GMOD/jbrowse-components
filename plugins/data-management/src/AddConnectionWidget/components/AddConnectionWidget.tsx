import { useMemo, useState } from 'react'

import {
  getEnv,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { getSnapshot } from '@jbrowse/mobx-state-tree'
import { isSessionWithConnections } from '@jbrowse/product-core'
import { Button, Step, StepContent, StepLabel, Stepper } from '@mui/material'
import { observer } from 'mobx-react'

import ConfigureConnection from './ConfigureConnection.tsx'
import ConnectionTypeSelect from './ConnectionTypeSelect.tsx'

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

const AddConnectionWidget = observer(function AddConnectionWidget({
  model,
}: {
  model: unknown
}) {
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  const connectionTypeChoices = pluginManager.getConnectionElements()
  const firstChoice = connectionTypeChoices[0]!
  const [connectionType, setConnectionType] = useState(firstChoice)
  const [connectionId, setConnectionId] = useState(
    `${firstChoice.name}-${Date.now()}`,
  )

  // useMemo is needed for react@18+mobx-react@9, previous code called configSchema.create directly in a setConfigModel useState hook setter but this caused infinite loop
  const { configModel, defaultSnapshot } = useMemo(() => {
    const m = connectionType.configSchema.create({ connectionId }, getEnv(model))
    return { configModel: m, defaultSnapshot: JSON.stringify(getSnapshot(m)) }
  }, [connectionId, connectionType, model])

  // guard against connecting with the untouched placeholder config (e.g. the
  // default hub.txt url), which always fails
  const isLastStep = activeStep === steps.length - 1
  const isUnconfigured =
    JSON.stringify(getSnapshot(configModel)) === defaultSnapshot

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
                  connectionTypeChoices={connectionTypeChoices}
                  connectionType={connectionType}
                  setConnectionType={c => {
                    setConnectionType(c)
                    setConnectionId(`${c.name}-${Date.now()}`)
                  }}
                />
              ) : (
                <ConfigureConnection
                  connectionType={connectionType}
                  model={configModel}
                />
              )}
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
                  disabled={isLastStep && isUnconfigured}
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    if (isLastStep) {
                      if (isSessionWithConnections(session)) {
                        const conf = session.addConnectionConf(configModel)
                        session.makeConnection(conf)
                      } else {
                        session.notify('This session does not support connections')
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
                  {isLastStep ? 'Connect' : 'Next'}
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
