import React, { useState } from 'react'
import {
  Alert,
  Button,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getRoot } from 'mobx-state-tree'

import {
  getSession,
  isElectron,
  supportedIndexingAdapters,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'

// locals
import ConfirmTrack from './ConfirmTrack'
import TrackSourceSelect from './TrackSourceSelect'

import { AddTrackModel } from '../model'

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
  stepContent: {
    margin: theme.spacing(1),
  },
  alertContainer: {
    padding: `${theme.spacing(2)}px 0px ${theme.spacing(2)}px 0px`,
  },
}))

const steps = ['Enter track data', 'Confirm track type']

function AddTrackWorkflow({ model }: { model: AddTrackModel }) {
  const [activeStep, setActiveStep] = useState(0)
  const { classes } = useStyles()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      `${trackName.toLowerCase().replace(/ /g, '_')}-${Date.now()}`,
      `${session.adminMode ? '' : '-sessionTrack'}`,
    ].join('')

    const assemblyInstance = session.assemblyManager.get(assembly)

    if (trackAdapter && trackAdapter.type !== 'UNKNOWN') {
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
      if (model.view) {
        model.view.showTrack(trackId)
        if (
          isElectron &&
          textIndexTrack &&
          supportedIndexingAdapters(trackAdapter.type)
        ) {
          const attr = textIndexingConf || {
            attributes: ['Name', 'ID'],
            exclude: ['CDS', 'exon'],
          }
          const indexName = trackName + '-index'
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
      } else {
        session.notify(
          'Open a new view, or use the track selector in an existing view, to view this track',
          'info',
        )
      }
      model.clearData()
      session.hideWidget(model)
    } else {
      setTrackErrorMessage(
        'Failed to add track.\nThe configuration of this file is not currently supported.',
      )
    }
  }

  function handleBack() {
    setTrackErrorMessage(undefined)
    setActiveStep(activeStep - 1)
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
                  onClick={handleBack}
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
}
export default observer(AddTrackWorkflow)
