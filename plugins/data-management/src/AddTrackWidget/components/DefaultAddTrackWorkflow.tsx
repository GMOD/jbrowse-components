import { useState } from 'react'

import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import ConfirmTrack from './ConfirmTrack'
import TrackSourceSelect from './TrackSourceSelect'
import { doSubmit } from './doSubmit'

import type { AddTrackModel } from '../model'

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

const steps = ['Enter track data', 'Confirm track type']

const DefaultAddTrackWorkflow = observer(function ({
  model,
}: {
  model: AddTrackModel
}) {
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()
  const { assembly, trackAdapter, trackData, trackName, trackType } = model

  function getStepContent(step: number) {
    switch (step) {
      case 0:
        return <TrackSourceSelect model={model} />
      case 1:
        return <ConfirmTrack model={model} />
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  function isNextDisabled() {
    switch (activeStep) {
      case 0:
        return !trackData
      case 1:
        return !(trackName && trackType && trackAdapter?.type && assembly)
      default:
        return true
    }
  }

  return (
    <div className={classes.root}>
      <Stepper
        className={classes.stepper}
        activeStep={activeStep}
        orientation="vertical"
      >
        {steps.map((label, idx) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
            <StepContent>
              {getStepContent(idx)}
              <div className={classes.actionsContainer}>
                <Button
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
                  disabled={isNextDisabled()}
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    if (activeStep !== steps.length - 1) {
                      setActiveStep(activeStep + 1)
                    } else {
                      try {
                        doSubmit({ model })
                      } catch (e) {
                        getSession(model).notifyError(`${e}`, e)
                      }
                    }
                  }}
                  className={classes.button}
                  data-testid="addTrackNextButton"
                >
                  {activeStep === steps.length - 1 ? 'Add' : 'Next'}
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
