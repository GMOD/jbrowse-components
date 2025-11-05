import { useEffect, useState } from 'react'

import { Slider, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

import type { DotplotDisplayModel } from '../../DotplotDisplay/stateModelFactory'
import type { DotplotViewModel } from '../model'
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
  model: DotplotViewModel
}) {
  const { classes } = useStyles()

  // Get the first display from the first track (if it exists)
  const firstDisplay = model.tracks[0]?.displays[0] as
    | DotplotDisplayModel
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
    <span className={classes.container}>
      <Typography variant="body2" style={{ marginRight: 8 }}>
        Min length:
      </Typography>
      <Slider
        value={minLengthValue}
        onChange={(_, val) => {
          setMinLengthValue(val)
        }}
        onChangeCommitted={() => {
          const newMinLength = Math.round(2 ** (minLengthValue / 100))
          // Set minAlignmentLength for all displays across all tracks
          for (const track of model.tracks) {
            for (const display of track.displays) {
              ;(display as DotplotDisplayModel).setMinAlignmentLength(
                newMinLength,
              )
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
    </span>
  )
})

export default MinLengthSlider
