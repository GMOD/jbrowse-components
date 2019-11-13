import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slider from '@material-ui/core/Slider'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    width: 48,
  },
})

function ZoomControls({ model }) {
  const classes = useStyles()
  return (
    <div className={classes.container}>
      <IconButton
        data-testid="zoom_out"
        onClick={() => {
          model.zoomTo(model.bpPerPx * 2)
        }}
      >
        <Icon color="secondary" fontSize="small">
          zoom_out
        </Icon>
      </IconButton>
      <Slider
        className={classes.slider}
        value={-Math.log2(model.bpPerPx)}
        min={-Math.log2(model.maxBpPerPx)}
        max={-Math.log2(model.minBpPerPx)}
        onChange={(event, value) => model.zoomTo(2 ** -value)}
      />
      <IconButton
        data-testid="zoom_in"
        onClick={() => {
          model.zoomTo(model.bpPerPx / 2)
        }}
      >
        <Icon color="secondary" fontSize="small">
          zoom_in
        </Icon>
      </IconButton>
    </div>
  )
}

ZoomControls.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ZoomControls)
