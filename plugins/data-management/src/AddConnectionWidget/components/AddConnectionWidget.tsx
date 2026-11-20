import { useMemo, useState } from 'react'

import {
  getEnv,
  getSession,
  isSessionModelWithConnectionEditing,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { Button, Step, StepContent, StepLabel, Stepper } from '@mui/material'
import { when } from 'mobx'
import { observer } from 'mobx-react'

import ConfigureConnection from './ConfigureConnection.tsx'
import ConnectionTypeSelect from './ConnectionTypeSelect.tsx'

import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type { SessionWithConnectionEditing, Widget } from '@jbrowse/core/util'

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

// A connect that fails reports itself and drops its live instance, which
// would leave the config behind as a row that fails again on every expand
async function deleteIfFirstConnectFails(
  session: SessionWithConnectionEditing,
  conf: BaseConnectionConfigModel,
) {
  const { connectionId } = conf
  const live = () =>
    session.connectionInstances.find(c => c.connectionId === connectionId)
  await when(() => !isAlive(session) || !live()?.loading)
  if (isAlive(session) && isAlive(conf) && !live()) {
    session.deleteConnection(conf)
  }
}

const AddConnectionWidget = observer(function AddConnectionWidget({
  model,
}: {
  model: Widget
}) {
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  const connectionTypeChoices = pluginManager.getConnectionElements()
  const firstChoice = connectionTypeChoices[0]!
  const [connectionType, setConnectionType] = useState(firstChoice)
  const [connectionId, setConnectionId] = useState(
    () => `${firstChoice.name}-${Date.now()}`,
  )

  // useMemo is needed for react@18+mobx-react@9, previous code called configSchema.create directly in a setConfigModel useState hook setter but this caused infinite loop
  const configModel = useMemo(
    () => connectionType.configSchema.create({ connectionId }, getEnv(model)),
    [connectionId, connectionType, model],
  )

  const isLastStep = activeStep === steps.length - 1

  function handleNext() {
    if (isLastStep) {
      if (isSessionModelWithConnectionEditing(session)) {
        const conf = session.addConnectionConf(configModel)
        session.makeConnection(conf)
        void deleteIfFirstConnectFails(session, conf)
      } else {
        session.notify('This session does not support connections')
      }
      if (isSessionModelWithWidgets(session)) {
        session.hideWidget(model)
      }
    } else {
      setActiveStep(activeStep + 1)
    }
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
                  variant="contained"
                  disabled={activeStep === 0}
                  onClick={() => {
                    setActiveStep(activeStep - 1)
                  }}
                  className={classes.button}
                >
                  Back
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    handleNext()
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
