import { useEffect, useState } from 'react'

import { Box, Slider, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { LinearComparativeViewModel } from '../model'
import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model'
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

const MinLengthSlider = observer(function ({
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

  const minAlignmentLength = firstDisplay?.minAlignmentLength ?? 0

  // Local state for min length slider with log scale
  const [minLengthValue, setMinLengthValue] = useState(
    Math.log2(Math.max(1, minAlignmentLength)) * 100,
  )

  useEffect(() => {
    setMinLengthValue(Math.log2(Math.max(1, minAlignmentLength)) * 100)
  }, [minAlignmentLength])

  return (
    <Box className={classes.container}>
      <Typography variant="body2" style={{ marginRight: 8 }}>
        Min length:
      </Typography>
      <Slider
        value={minLengthValue}
        onChange={(_, val) => {
          setMinLengthValue(val as number)
        }}
        onChangeCommitted={() => {
          const newMinLength = Math.round(2 ** (minLengthValue / 100))
          // Set minAlignmentLength for all synteny displays across all levels
          for (const level of levels) {
            for (const track of level.tracks) {
              for (const display of track.displays) {
                ;(
                  display as LinearSyntenyDisplayModel
                ).setMinAlignmentLength(newMinLength)
              }
            }
          }
        }}
        min={0}
        max={Math.log2(1000000) * 100}
        valueLabelDisplay="auto"
        valueLabelFormat={newValue =>
          Math.round(2 ** (newValue / 100)).toLocaleString()
        }
        size="small"
        style={{ minWidth: 100 }}
        slots={{
          valueLabel: ValueLabelComponent,
        }}
      />
    </Box>
  )
})

export default MinLengthSlider
