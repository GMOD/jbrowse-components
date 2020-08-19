import React, { useState } from 'react'
import { observer } from 'mobx-react'
import IconButton from '@material-ui/core/IconButton'
import Slider from '@material-ui/core/Slider'
import { makeStyles } from '@material-ui/core/styles'
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
  const [value, setValue] = useState(-Math.log2(bpPerPx) * 100)
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
        value={value}
        min={-Math.log2(maxBpPerPx) * 100}
        max={-Math.log2(minBpPerPx) * 100}
        onChange={(event, val) => setValue(val as number)}
        onChangeCommitted={event => model.zoomTo(2 ** (-value / 100))}
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

export default observer(ZoomControls)
