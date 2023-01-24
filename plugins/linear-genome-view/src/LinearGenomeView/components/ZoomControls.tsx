import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { Slider, IconButton } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import ZoomIn from '@mui/icons-material/ZoomIn'
import ZoomOut from '@mui/icons-material/ZoomOut'
import { LinearGenomeViewModel } from '..'

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

function ZoomControls({ model }: { model: LinearGenomeViewModel }) {
  const { classes } = useStyles()
  const { maxBpPerPx, minBpPerPx, bpPerPx, scaleFactor } = model
  const [value, setValue] = useState(-Math.log2(bpPerPx) * 100)
  useEffect(() => {
    setValue(-Math.log2(bpPerPx) * 100)
  }, [setValue, bpPerPx])

  return (
    <div className={classes.container}>
      <IconButton
        data-testid="zoom_out"
        onClick={() => model.zoom(bpPerPx * 2)}
        disabled={bpPerPx >= maxBpPerPx - 0.0001 || scaleFactor !== 1}
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
        onChange={(_, val) => setValue(val as number)}
        onChangeCommitted={() => model.zoomTo(2 ** (-value / 100))}
        disabled={scaleFactor !== 1}
      />
      <IconButton
        data-testid="zoom_in"
        onClick={() => model.zoom(model.bpPerPx / 2)}
        disabled={bpPerPx <= minBpPerPx + 0.0001 || scaleFactor !== 1}
        size="large"
      >
        <ZoomIn />
      </IconButton>
    </div>
  )
}

export default observer(ZoomControls)
