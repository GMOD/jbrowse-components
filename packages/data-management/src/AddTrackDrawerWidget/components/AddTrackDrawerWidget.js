import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { PropTypes as MobxPropTypes } from 'mobx-react'
import { observer } from 'mobx-react-lite'
import { getRoot } from 'mobx-state-tree'
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
  const [assemblyName, setAssemblyName] = useState('')

  const { classes, model } = props

  const rootModel = getRoot(model)

  function getStepContent(currStep) {
    switch (currStep) {
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
            rootModel={rootModel}
            trackData={trackData}
            trackName={trackName}
            setTrackName={setTrackName}
            trackType={trackType}
            setTrackType={setTrackType}
            trackAdapter={trackAdapter}
            setTrackAdapter={setTrackAdapter}
            assemblyName={assemblyName}
            setAssemblyName={setAssemblyName}
          />
        )
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  function handleNext() {
    if (activeStep === steps.length - 1) {
      trackAdapter.features = trackData.config
      const trackConf = rootModel.configuration.assemblies
        .find(
          assembly => readConfObject(assembly, 'assemblyName') === assemblyName,
        )
        .addTrackConf(trackType, {
          name: trackName,
          adapter: trackAdapter,
        })
      model.view.showTrack(trackConf)
      rootModel.hideDrawerWidget(
        rootModel.drawerWidgets.get('addTrackDrawerWidget'),
      )
      return
    }
    setActiveStep(activeStep + 1)
  }

  function handleBack() {
    setActiveStep(activeStep - 1)
    setTrackData({})
  }

  function isNextDisabled() {
    switch (activeStep) {
      case 0:
        return !(trackData.uri || trackData.localPath || trackData.config)
      case 1:
        return !(trackName && trackType && trackAdapter.type && assemblyName)
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
        {steps.map((step, index) => (
          <Step key={steps[activeStep]}>
            <StepLabel>{steps[activeStep]}</StepLabel>
            <StepContent>
              {getStepContent(activeStep)}
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
                  data-testid={
                    activeStep === index
                      ? 'addTrackNextButton'
                      : 'addTrackNextButton-notcurrent'
                  }
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
