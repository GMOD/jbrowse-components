import { readConfObject } from '@gmod/jbrowse-core/configuration'
import { getSession } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React, { useState } from 'react'
import ConfirmTrack from './ConfirmTrack'
import TrackSourceSelect from './TrackSourceSelect'

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
}))

const steps = ['Enter track data', 'Confirm track type']

function AddTrackDrawerWidget({ model }) {
  const [activeStep, setActiveStep] = useState(0)
  const [trackSource, setTrackSource] = useState('fromFile')
  const [trackData, setTrackData] = useState({ uri: '' })
  const [trackName, setTrackName] = useState('')
  const [trackType, setTrackType] = useState('')
  const [trackAdapter, setTrackAdapter] = useState({})
  const [datasetName, setDatasetName] = useState('')
  const classes = useStyles()

  const session = getSession(model)

  function getStepContent(step) {
    switch (step) {
      case 0:
        return (
          <TrackSourceSelect
            trackSource={trackSource}
            setTrackSource={setTrackSource}
            trackData={trackData}
            setTrackData={setTrackData}
          />
        )
      case 1:
        return (
          <ConfirmTrack
            session={session}
            trackData={trackData}
            trackName={trackName}
            setTrackName={setTrackName}
            trackType={trackType}
            setTrackType={setTrackType}
            trackAdapter={trackAdapter}
            setTrackAdapter={setTrackAdapter}
            datasetName={datasetName}
            setDatasetName={setDatasetName}
          />
        )
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  function handleNext() {
    if (activeStep !== steps.length - 1) {
      setActiveStep(activeStep + 1)
      return
    }
    trackAdapter.features = trackData.config
    const trackId = `${trackName
      .toLowerCase()
      .replace(/ /g, '_')}-${Date.now()}`
    const trackConf = session.datasets
      .find(dataset => readConfObject(dataset, 'name') === datasetName)
      .addTrackConf({
        trackId,
        type: trackType,
        name: trackName,
        adapter: trackAdapter,
      })
    if (model.view) {
      model.view.showTrack(trackConf)
    } else {
      session.setSnackbarMessage(
        'Open a new view, or use the track selector in an existing view, to view this track',
      )
    }
    session.hideDrawerWidget(model)
  }

  function handleBack() {
    setActiveStep(activeStep - 1)
  }

  function isNextDisabled() {
    switch (activeStep) {
      case 0:
        return !(
          trackData.uri ||
          trackData.localPath ||
          trackData.blob ||
          trackData.config
        )
      case 1:
        return !(trackName && trackType && trackAdapter.type && datasetName)
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
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </div>
  )
}

AddTrackDrawerWidget.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(AddTrackDrawerWidget)
