import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Box, Slider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SliderTooltip from './SliderTooltip.tsx'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'
import type { LinearComparativeViewModel } from '../model.ts'

const useStyles = makeStyles()({
  container: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    minWidth: 150,
  },
})

const MaxOffScreenSlider = observer(function MaxOffScreenSlider({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const view = model as unknown as LinearSyntenyViewModel
  if (!('maxOffScreenDrawPx' in view)) {
    return null
  }

  return (
    <Box className={classes.container}>
      <Typography variant="body2" style={{ marginRight: 8 }}>
        Off-screen:
      </Typography>
      <Slider
        value={view.maxOffScreenDrawPx}
        onChange={(_, val) => {
          view.setMaxOffScreenDrawPx(val as number)
        }}
        min={0}
        max={10000}
        step={100}
        valueLabelDisplay="auto"
        size="small"
        style={{ minWidth: 100 }}
        valueLabelFormat={(val: number) => `${val}px`}
        slots={{
          valueLabel: SliderTooltip,
        }}
      />
    </Box>
  )
})

export default MaxOffScreenSlider
