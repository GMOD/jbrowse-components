import React from 'react'
import PropTypes from 'prop-types'
import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slider from '@material-ui/core/Slider'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { withStyles } from '@material-ui/core/styles'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    width: 48,
  },
}

function ZoomControls(props) {
  const { classes, model, controlsHeight } = props
  return (
    <div className={classes.container} style={{ height: controlsHeight }}>
      <IconButton
        onClick={() => {
          model.zoomTo(model.bpPerPx * 2)
        }}
      >
        <Icon fontSize="small">zoom_out</Icon>
      </IconButton>
      <Slider
        className={classes.slider}
        value={-Math.log2(model.bpPerPx)}
        min={-Math.log2(model.maxBpPerPx)}
        max={-Math.log2(model.minBpPerPx)}
        onChange={(event, value) => model.zoomTo(2 ** -value)}
      />
      <IconButton
        onClick={() => {
          model.zoomTo(model.bpPerPx / 2)
        }}
      >
        <Icon fontSize="small">zoom_in</Icon>
      </IconButton>
    </div>
  )
}

ZoomControls.propTypes = {
  classes: PropTypes.objectOf(PropTypes.string).isRequired,
  model: MobxPropTypes.observableObject.isRequired,
  controlsHeight: PropTypes.number.isRequired,
}

export default withStyles(styles)(observer(ZoomControls))
