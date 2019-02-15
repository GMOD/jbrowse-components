import Button from '@material-ui/core/Button'
import Step from '@material-ui/core/Step'
import StepContent from '@material-ui/core/StepContent'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { withStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getRoot } from 'mobx-state-tree'
import propTypes from 'prop-types'
import React from 'react'
import ConfirmTrack from './ConfirmTrack'
import TrackSourceSelect from './TrackSourceSelect'

const styles = theme => ({
  root: {
    marginTop: theme.spacing.unit,
  },
  stepper: {
    backgroundColor: theme.palette.background.default,
  },
  button: {
    marginTop: theme.spacing.unit,
    marginRight: theme.spacing.unit,
  },
  actionsContainer: {
    marginBottom: theme.spacing.unit * 2,
  },
  stepContent: {
    margin: theme.spacing.unit,
  },
})

const steps = ['Enter track data', 'Confirm track type']

class AddTrackDrawerWidget extends React.Component {
  static propTypes = {
    classes: propTypes.objectOf(propTypes.string).isRequired,
    model: MobxPropTypes.observableObject.isRequired,
  }

  state = {
    activeStep: 0,
    trackData: {},
    trackName: '',
    trackType: '',
    trackAdapter: {},
  }

  get stepContent() {
    const {
      activeStep,
      trackData,
      trackName,
      trackType,
      trackAdapter,
    } = this.state
    const { model } = this.props
    switch (activeStep) {
      case 0:
        return (
          <TrackSourceSelect
            updateTrackData={newTrackData =>
              this.setState({ trackData: newTrackData })
            }
          />
        )
      case 1:
        return (
          <ConfirmTrack
            rootModel={getRoot(model)}
            trackData={trackData}
            trackName={trackName}
            updateTrackName={event =>
              this.setState({ trackName: event.target.value })
            }
            trackType={trackType}
            updateTrackType={event =>
              this.setState({ trackType: event.target.value })
            }
            trackAdapter={trackAdapter}
            updateTrackAdapter={newTrackAdapter =>
              this.setState({ trackAdapter: newTrackAdapter })
            }
          />
        )
      default:
        return <Typography>Unknown step</Typography>
    }
  }

  handleNext = () => {
    const {
      activeStep,
      trackName,
      trackData,
      trackType,
      trackAdapter,
    } = this.state
    const { model } = this.props
    const rootModel = getRoot(model)
    if (activeStep === steps.length - 1) {
      trackAdapter.features = trackData.config
      const trackConf = rootModel.configuration.addTrackConf(trackType, {
        name: trackName,
        adapter: trackAdapter,
      })
      rootModel.editConfiguration(trackConf)
      rootModel.hideDrawerWidget(
        rootModel.drawerWidgets.get('addTrackDrawerWidget'),
      )
      return
    }
    this.setState(state => ({
      activeStep: state.activeStep + 1,
    }))
  }

  handleBack = () => {
    this.setState(state => ({
      activeStep: state.activeStep - 1,
      trackData: {},
    }))
  }

  isNextDisabled() {
    const {
      activeStep,
      trackData,
      trackName,
      trackType,
      trackAdapter,
    } = this.state
    switch (activeStep) {
      case 0:
        return !(trackData.uri || trackData.localPath || trackData.config)
      case 1:
        return !(trackName && trackType && trackAdapter.type)
      default:
        return true
    }
  }

  render() {
    const { classes } = this.props
    const { activeStep } = this.state

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
                {this.stepContent}
                <div className={classes.actionsContainer}>
                  <Button
                    disabled={activeStep === 0}
                    onClick={this.handleBack}
                    className={classes.button}
                  >
                    Back
                  </Button>
                  <Button
                    disabled={this.isNextDisabled()}
                    variant="contained"
                    color="primary"
                    onClick={this.handleNext}
                    className={classes.button}
                  >
                    {activeStep === steps.length - 1
                      ? 'Add and Configure'
                      : 'Next'}
                  </Button>
                </div>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </div>
    )
  }
}

export default withStyles(styles)(observer(AddTrackDrawerWidget))
