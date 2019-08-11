import { getSession } from '@gmod/jbrowse-core/util'
import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import propTypes from 'prop-types'
import React, { useState } from 'react'
import { readConfObject } from '@gmod/jbrowse-core/configuration'
import ConfirmTrack from './ConfirmTrack'
import TrackSourceSelect from './TrackSourceSelect'

const styles = theme => ({
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
})

const steps = ['Enter track data', 'Confirm track type']

function AddTrackDrawerWidget(props) {
  const [activeStep, setActiveStep] = useState(0)
  const [trackSource, setTrackSource] = useState('fromFile')
  const [trackData, setTrackData] = useState({ uri: '' })
  const [trackName, setTrackName] = useState('')
  const [trackType, setTrackType] = useState('')
  const [trackAdapter, setTrackAdapter] = useState({})
  const [datasetName, setDatasetName] = useState('')

  const { classes, model } = props

  const session = getSession(model)

  function getStepContent() {
    switch (activeStep) {
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
    const trackConf = session.datasets
      .find(dataset => readConfObject(dataset, 'name') === datasetName)
      .addTrackConf({
        type: trackType,
        name: trackName,
        adapter: trackAdapter,
      })
    model.view.showTrack(trackConf)
    session.hideDrawerWidget(model)
  }

  function handleBack() {
    setActiveStep(activeStep - 1)
  }

  function isNextDisabled() {
    switch (activeStep) {
      case 0:
        return !(trackData.uri || trackData.localPath || trackData.config)
      case 1:
        return !(trackName && trackType && trackAdapter.type && datasetName)
      default:
        return true
    }
  }
  console.log(steps)

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
              {getStepContent()}
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
  classes: propTypes.objectOf(propTypes.string).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
}

export default withStyles(styles)(observer(AddTrackDrawerWidget))
