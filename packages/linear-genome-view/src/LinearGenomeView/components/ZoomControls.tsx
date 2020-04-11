import Icon from '@material-ui/core/Icon'
import IconButton from '@material-ui/core/IconButton'
import Slider from '@material-ui/core/Slider'
import { makeStyles } from '@material-ui/core/styles'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
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
  const marks = model.zoomLevels.map(zoomLevel => ({
    value: -Math.log2(zoomLevel),
  }))
  marks.reverse()
  return (
    <div className={classes.container}>
      <IconButton
        data-testid="zoom_out"
        onClick={() => {
          model.zoom(-1)
        }}
        disabled={model.bpPerPx >= model.maxBpPerPx}
        color="secondary"
      >
        <Icon fontSize="small">zoom_out</Icon>
      </IconButton>
      <Slider
        className={classes.slider}
        marks={marks}
        step={null}
        value={-Math.log2(model.bpPerPx)}
        min={marks[0].value}
        max={marks[marks.length - 1].value}
        onChange={(event, value) => model.zoomTo(2 ** -value)}
      />
      <IconButton
        data-testid="zoom_in"
        onClick={() => {
          model.zoom(1)
        }}
        disabled={model.bpPerPx <= model.minBpPerPx}
        color="secondary"
      >
        <Icon fontSize="small">zoom_in</Icon>
      </IconButton>
    </div>
  )
}

ZoomControls.propTypes = {
  model: MobxPropTypes.observableObject.isRequired,
}

export default observer(ZoomControls)
