import { Box, Slider, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model'
import type { LinearComparativeViewModel } from '../model'
import type { SliderValueLabelProps } from '@mui/material'

const useStyles = makeStyles()({
  container: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 16,
    marginRight: 16,
    minWidth: 150,
  },
})

function ValueLabelComponent(props: SliderValueLabelProps) {
  const { children, open, value } = props
  return (
    <Tooltip
      open={open}
      enterTouchDelay={0}
      placement="top"
      title={value}
      arrow
    >
      {children}
    </Tooltip>
  )
}

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

  const handleAlphaChange = (_event: Event, value: number | number[]) => {
    const newAlpha = typeof value === 'number' ? value : value[0]!
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
        value={alpha}
        onChange={handleAlphaChange}
        min={0}
        max={1}
        step={0.05}
        valueLabelDisplay="auto"
        size="small"
        style={{ minWidth: 100 }}
        slots={{
          valueLabel: ValueLabelComponent,
        }}
      />
    </Box>
  )
})

export default OpacitySlider
