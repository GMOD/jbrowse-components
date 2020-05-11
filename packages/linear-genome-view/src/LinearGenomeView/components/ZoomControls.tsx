import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slider from '@material-ui/core/Slider'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import ZoomIn from '@material-ui/icons/ZoomIn'
import ZoomOut from '@material-ui/icons/ZoomOut'
import { LinearGenomeViewStateModel } from '..'
type LGV = Instance<LinearGenomeViewStateModel>

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

function ZoomControls({ model }: { model: LGV }) {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <IconButton
        data-testid="zoom_out"
        onClick={() => {
          model.zoom(model.bpPerPx * 2)
        }}
        disabled={model.bpPerPx >= model.maxBpPerPx || model.scaleFactor !== 1}
        color="secondary"
      >
        <ZoomOut fontSize="small"/>
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
          model.zoom(model.bpPerPx / 2)
        }}
        disabled={model.bpPerPx <= model.minBpPerPx || model.scaleFactor !== 1}
        color="secondary"
      >
        <ZoomIn fontSize="small"/>
      </IconButton>
    </div>
  )
}

ZoomControls.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ZoomControls)
