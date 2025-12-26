import { useEffect, useState } from 'react'

import { toLocale } from '@jbrowse/core/util'
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

const MinLengthSlider = observer(function MinLengthSlider({
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
          setMinLengthValue(val)
        }}
        onChangeCommitted={() => {
          const newMinLength = Math.round(2 ** (minLengthValue / 100))
          // Set minAlignmentLength for all synteny displays across all levels
          for (const level of levels) {
            for (const track of level.tracks) {
              for (const display of track.displays) {
                ;(display as LinearSyntenyDisplayModel).setMinAlignmentLength(
                  newMinLength,
                )
              }
            }
          }
        }}
        min={0}
        max={Math.log2(1000000) * 100}
        valueLabelDisplay="auto"
        valueLabelFormat={val => toLocale(Math.round(2 ** (val / 100)))}
        size="small"
        style={{ minWidth: 100 }}
        slots={{
          valueLabel: SliderTooltip,
        }}
      />
    </Box>
  )
})

export default MinLengthSlider
