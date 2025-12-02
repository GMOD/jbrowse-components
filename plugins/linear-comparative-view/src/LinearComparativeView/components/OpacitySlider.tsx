import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Box, Slider, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import SliderTooltip from './SliderTooltip'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model'
import type { LinearComparativeViewModel } from '../model'

const useStyles = makeStyles()({
  container: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    minWidth: 150,
  },
})

const OpacitySlider = observer(function ({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const { classes } = useStyles()
  const { levels } = model

  // Get the first synteny display from the first level (if it exists)
  const firstDisplay = levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined

  const alpha = firstDisplay?.alpha ?? 1

  // Use a cubic function for logarithmic-like scaling
  // More granularity near 0, coarser towards 1
  const exponent = 3
  const alphaToSlider = (a: number) => Math.pow(a, 1 / exponent)
  const sliderToAlpha = (s: number) => Math.pow(s, exponent)

  const sliderValue = alphaToSlider(alpha)

  const handleAlphaChange = (_event: Event, value: number | number[]) => {
    const sliderVal = typeof value === 'number' ? value : value[0]!
    const newAlpha = sliderToAlpha(sliderVal)
    // Set alpha for all synteny displays across all levels
    for (const level of levels) {
      for (const track of level.tracks) {
        for (const display of track.displays) {
          ;(display as LinearSyntenyDisplayModel).setAlpha(newAlpha)
        }
      }
    }
  }

  return (
    <Box className={classes.container}>
      <Typography variant="body2" style={{ marginRight: 8 }}>
        Opacity:
      </Typography>
      <Slider
        value={sliderValue}
        onChange={handleAlphaChange}
        min={0}
        max={1}
        step={0.01}
        valueLabelDisplay="auto"
        size="small"
        style={{ minWidth: 100 }}
        slots={{
          valueLabel: SliderTooltip,
        }}
        valueLabelFormat={(value: number) => sliderToAlpha(value).toFixed(3)}
      />
    </Box>
  )
})

export default OpacitySlider
