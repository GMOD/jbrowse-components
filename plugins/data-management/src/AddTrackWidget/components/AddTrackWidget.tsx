import React, { useState } from 'react'
import {
  Button,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
  makeStyles,
} from '@material-ui/core'
import {
  getSession,
  isElectron,
  supportedIndexingAdapters,
} from '@jbrowse/core/util'
import { getConf } from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { Alert } from '@material-ui/lab'

// locals
import ConfirmTrack from './ConfirmTrack'
import TrackSourceSelect from './TrackSourceSelect'
import { AddTrackModel } from '../model'

const useStyles = makeStyles(theme => ({
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

function AddTrackWidget({ model }: { model: AddTrackModel }) {
  const [activeStep, setActiveStep] = useState(0)
  const classes = useStyles()
  const session = getSession(model)
  const { pluginManager } = getEnv(session)
  const { rootModel } = pluginManager
  const { jobsManager } = rootModel
  const {
    assembly,
    trackAdapter,
    trackData,
    trackName,
    trackType,
    textIndexTrack,
    textIndexingConf,
  } = model
  const [trackErrorMessage, setTrackErrorMessage] = useState<String>()

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

    const trackId = `${trackName
      .toLowerCase()
      .replace(/ /g, '_')}-${Date.now()}${
      session.adminMode ? '' : '-sessionTrack'
    }`

    const assemblyInstance = session.assemblyManager.get(assembly)

    if (trackAdapter && trackAdapter.type !== 'UNKNOWN') {
      // @ts-ignore
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
      const textSearchingDefault = {
        attributes: ['Name', 'ID'],
        exclude: ['CDS', 'exon'],
      }
      if (model.view) {
        model.view.showTrack(trackId)
        if (isElectron) {
          if (textIndexTrack && supportedIndexingAdapters(trackAdapter.type)) {
            const attr = textIndexingConf || textSearchingDefault
            const indexName = trackName + '-index'
            const indexingParams = {
              ...attr,
              assemblies: [assembly],
              tracks: [trackId],
              indexType: 'perTrack',
              name: indexName,
              timestamp: new Date().toISOString(),
            }
            const newEntry = {
              params: indexingParams,
              name: indexName,
              cancelCallback: () => {
                jobsManager.setAbort(true)
              },
            }
            jobsManager.queueJob(newEntry)
          }
        }
      } else {
        session.notify(
          'Open a new view, or use the track selector in an existing view, to view this track',
          'info',
        )
      }
      model.clearData()
      // @ts-ignore
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

export default observer(AddTrackWidget)
