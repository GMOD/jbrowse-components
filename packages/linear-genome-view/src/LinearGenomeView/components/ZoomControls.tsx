import IconButton from '@material-ui/core/IconButton'
import Slider from '@material-ui/core/Slider'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import React from 'react'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ZoomOut from '@material-ui/icons/ZoomOut'
import { LinearGenomeViewModel } from '..'

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    width: 70,
  },
})

function ZoomControls({ model }: { model: LinearGenomeViewModel }) {
  const classes = useStyles()
  const { maxBpPerPx, minBpPerPx, bpPerPx, scaleFactor } = model

  return (
    <div className={classes.container}>
      <IconButton
        data-testid="zoom_out"
        onClick={() => {
          model.zoom(bpPerPx * 2)
        }}
        disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
        color="secondary"
      >
        <ZoomOut fontSize="small" />
      </IconButton>

      <Slider
        className={classes.slider}
        value={-Math.log2(bpPerPx)}
        min={-Math.log2(maxBpPerPx)}
        max={-Math.log2(minBpPerPx)}
        onChangeCommitted={(event, value) => model.zoomTo(2 ** -value)}
      />
      <IconButton
        data-testid="zoom_in"
        onClick={() => {
          model.zoom(model.bpPerPx / 2)
        }}
        disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
        color="secondary"
      >
        <ZoomIn fontSize="small" />
      </IconButton>
    </div>
  )
}

ZoomControls.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ZoomControls)
