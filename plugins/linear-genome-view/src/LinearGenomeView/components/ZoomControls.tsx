import React, { useState, useEffect } from 'react'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { Slider, IconButton } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'
import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    width: 70,
    color: theme.palette.text.secondary,
  },
}))

const ZoomControls = observer(function ({
  model,
}: {
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const { maxBpPerPx, minBpPerPx, bpPerPx } = model
  const [value, setValue] = useState(-Math.log2(bpPerPx) * 100)
  useEffect(() => {
    setValue(-Math.log2(bpPerPx) * 100)
  }, [bpPerPx])

  return (
    <div className={classes.container}>
      <IconButton
        data-testid="zoom_out"
        onClick={() => {
          model.zoom(bpPerPx * 2)
        }}
        disabled={bpPerPx >= maxBpPerPx - 0.0001}
        size="large"
      >
        <ZoomOut />
      </IconButton>

      <Slider
        size="small"
        className={classes.slider}
        value={value}
        min={-Math.log2(maxBpPerPx) * 100}
        max={-Math.log2(minBpPerPx) * 100}
        onChange={(_, val) => {
          setValue(val as number)
        }}
        onChangeCommitted={() => model.zoomTo(2 ** (-value / 100))}
      />
      <IconButton
        data-testid="zoom_in"
        onClick={() => {
          model.zoom(model.bpPerPx / 2)
        }}
        disabled={bpPerPx <= minBpPerPx + 0.0001}
        size="large"
      >
        <ZoomIn />
      </IconButton>
    </div>
  )
})

export default ZoomControls
