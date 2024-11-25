import React, { useState } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import {
  getSession,
  isElectron,
  isSessionModelWithWidgets,
  isSessionWithAddTracks,
  isSupportedIndexingAdapter,
} from '@jbrowse/core/util'
import {
  Alert,
  Button,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import { makeStyles } from 'tss-react/mui'

// locals
import ConfirmTrack from './ConfirmTrack'
import TrackSourceSelect from './TrackSourceSelect'
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
  alertContainer: {
    padding: `${theme.spacing(2)}px 0px ${theme.spacing(2)}px 0px`,
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

  const { jobsManager } = getRoot<any>(model)
  const session = getSession(model)
  const {
    assembly,
    trackAdapter,
    trackData,
    trackName,
    trackType,
    textIndexTrack,
    textIndexingConf,
  } = model
  const [trackErrorMessage, setTrackErrorMessage] = useState<string>()

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

  async function handleNext() {
    if (activeStep !== steps.length - 1) {
      setActiveStep(activeStep + 1)
      return
    }

    const trackId = [
      `${trackName.toLowerCase().replaceAll(' ', '_')}-${Date.now()}`,
      session.adminMode ? '' : '-sessionTrack',
    ].join('')

    const assemblyInstance = session.assemblyManager.get(assembly)
    if (!isSessionWithAddTracks(session)) {
      setTrackErrorMessage('Unable to add tracks to this model')
      return
    }
    if (assemblyInstance && trackAdapter && trackAdapter.type !== 'UNKNOWN') {
      session.addTrackConf({
        trackId,
        type: trackType,
        name: trackName,
        assemblyNames: [assembly],
        adapter: {
          ...trackAdapter,
          sequenceAdapter: getConf(assemblyInstance, ['sequence', 'adapter']),
        },
      })
      model.view.showTrack?.(trackId)
      if (
        isElectron &&
        textIndexTrack &&
        isSupportedIndexingAdapter(trackAdapter.type)
      ) {
        const attr = textIndexingConf || {
          attributes: ['Name', 'ID'],
          exclude: ['CDS', 'exon'],
        }
        const indexName = `${trackName}-index`
        const newEntry = {
          indexingParams: {
            ...attr,
            assemblies: [assembly],
            tracks: [trackId],
            indexType: 'perTrack',
            name: indexName,
            timestamp: new Date().toISOString(),
          },
          name: indexName,
          cancelCallback: () => jobsManager.abortJob(),
        }
        jobsManager.queueJob(newEntry)
      }
      model.clearData()
      if (isSessionModelWithWidgets(session)) {
        session.hideWidget(model)
      }
    } else {
      setTrackErrorMessage(
        'Failed to add track.\nThe configuration of this file is not currently supported.',
      )
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
                  onClick={() => {
                    setTrackErrorMessage(undefined)
                    setActiveStep(activeStep - 1)
                  }}
                  className={classes.button}
                >
                  Back
                </Button>
                <Button
                  disabled={isNextDisabled()}
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  className={classes.button}
                  data-testid="addTrackNextButton"
                >
                  {activeStep === steps.length - 1 ? 'Add' : 'Next'}
                </Button>
              </div>
              {trackErrorMessage ? (
                <div className={classes.alertContainer}>
                  <Alert severity="error">{trackErrorMessage}</Alert>
                </div>
              ) : null}
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </div>
  )
})
export default DefaultAddTrackWorkflow
