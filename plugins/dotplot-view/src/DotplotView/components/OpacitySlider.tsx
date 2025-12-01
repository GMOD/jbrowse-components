import { Slider, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import SliderTooltip from './SliderTooltip'

import type { DotplotDisplayModel } from '../../DotplotDisplay/stateModelFactory'
import type { DotplotViewModel } from '../model'

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
  model: DotplotViewModel
}) {
  const { classes } = useStyles()

  // Get the first display from the first track (if it exists)
  const firstDisplay = model.tracks[0]?.displays[0] as
    | DotplotDisplayModel
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
    // Set alpha for all displays across all tracks
    for (const track of model.tracks) {
      for (const display of track.displays) {
        ;(display as DotplotDisplayModel).setAlpha(newAlpha)
      }
    }
  }

  return (
    <span className={classes.container}>
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
        valueLabelFormat={value => sliderToAlpha(value).toFixed(3)}
      />
    </span>
  )
})

export default OpacitySlider
