import { useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Link,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ConfirmTrack from './ConfirmTrack.tsx'
import TrackSourceSelect from './TrackSourceSelect.tsx'
import { doSubmit } from './doSubmit.ts'
import { BULK_WORKFLOW } from '../workflowNames.ts'

import type { AddTrackModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  root: {
    marginTop: theme.spacing(1),
  },
  stepper: {
    backgroundColor: theme.palette.background.default,
  },
  button: {
    marginRight: theme.spacing(1),
  },
  actionsContainer: {
    marginTop: theme.spacing(10),
    marginBottom: theme.spacing(2),
  },
}))

const steps = [
  {
    label: 'Enter track data',
    content: (model: AddTrackModel) => <TrackSourceSelect model={model} />,
    isComplete: (model: AddTrackModel) => !!model.trackData,
  },
  {
    label: 'Confirm track type',
    content: (model: AddTrackModel) => <ConfirmTrack model={model} />,
    isComplete: (model: AddTrackModel) =>
      !!(
        model.trackName &&
        model.trackType &&
        model.trackAdapter?.type &&
        model.assembly
      ),
  },
]

const DefaultAddTrackWorkflow = observer(function DefaultAddTrackWorkflow({
  model,
  switchWorkflow,
}: {
  model: AddTrackModel
  switchWorkflow: (name: string) => void
}) {
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()
  const isLastStep = activeStep === steps.length - 1

  function handleNext() {
    if (isLastStep) {
      try {
        doSubmit({ model })
      } catch (e) {
        getSession(model).notifyError(`${e}`, e)
      }
    } else {
      setActiveStep(activeStep + 1)
    }
  }

  return (
    <div className={classes.root} data-testid="addTrackWorkflow">
      <Typography variant="body2" color="textSecondary">
        Have multiple files?{' '}
        <Link
          component="button"
          variant="body2"
          onClick={() => {
            switchWorkflow(BULK_WORKFLOW)
          }}
        >
          Add multiple tracks at once
        </Link>
      </Typography>
      <Stepper
        className={classes.stepper}
        activeStep={activeStep}
        orientation="vertical"
      >
        {steps.map(({ label, content, isComplete }) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {content(model)}
              <div className={classes.actionsContainer}>
                <Button
                  variant="contained"
                  disabled={activeStep === 0}
                  className={classes.button}
                  onClick={() => {
                    setActiveStep(activeStep - 1)
                  }}
                  data-testid="addTrackBackButton"
                >
                  Back
                </Button>
                <Button
                  disabled={!isComplete(model)}
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    handleNext()
                  }}
                  className={classes.button}
                  data-testid="addTrackNextButton"
                >
                  {isLastStep ? 'Add' : 'Next'}
                </Button>
              </div>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </div>
  )
})
export default DefaultAddTrackWorkflow
