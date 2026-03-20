import { Box, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { LinearSyntenyDisplayModel } from '../../LinearSyntenyDisplay/model.ts'
import type { LinearComparativeViewModel } from '../model.ts'

const syriLegendItems = [
  { label: 'SYN', color: syriColors.SYN },
  { label: 'INV', color: syriColors.INV },
  { label: 'TRANS', color: syriColors.TRANS },
  { label: 'DUP', color: syriColors.DUP },
]

const ColorLegend = observer(function ColorLegend({
  model,
}: {
  model: LinearComparativeViewModel
}) {
  const firstDisplay = model.levels[0]?.tracks[0]?.displays[0] as
    | LinearSyntenyDisplayModel
    | undefined
  const colorBy = firstDisplay?.colorBy

  if (colorBy !== 'syri') {
    return null
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 1 }}>
      {syriLegendItems.map(item => (
        <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
          <Box
            sx={{
              width: 12,
              height: 12,
              backgroundColor: item.color,
              borderRadius: '2px',
              border: '1px solid #999',
            }}
          />
          <Typography variant="caption">{item.label}</Typography>
        </Box>
      ))}
    </Box>
  )
})

export default ColorLegend
