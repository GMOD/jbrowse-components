import { SingleSlider } from '@jbrowse/core/ui'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

const ScatterPointSizeSlider = observer(function ScatterPointSizeSlider({
  model,
}: {
  model: {
    scatterPointSize: number
    setScatterPointSize: (n?: number) => void
  }
}) {
  return (
    <div style={{ width: 200 }}>
      <Typography variant="caption" color="textSecondary">
        Point size: {model.scatterPointSize}px
      </Typography>
      <SingleSlider
        value={model.scatterPointSize}
        min={1}
        max={12}
        step={1}
        size="small"
        valueLabelDisplay="auto"
        valueLabelFormat={(v: number) => `${v}px`}
        onChange={v => {
          model.setScatterPointSize(v)
        }}
      />
    </div>
  )
})

export default ScatterPointSizeSlider
