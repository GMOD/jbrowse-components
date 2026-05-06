import { Box, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { syriColors } from '../../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { LinearSyntenyViewModel } from '../../LinearSyntenyView/model.ts'

const syriLegendItems = [
  { label: 'SYN', color: syriColors.SYN },
  { label: 'INV', color: syriColors.INV },
  { label: 'TRANS', color: syriColors.TRANS },
  { label: 'DUP', color: syriColors.DUP },
]

const ColorLegend = observer(function ColorLegend({
  model,
}: {
  model: LinearSyntenyViewModel
}) {
  if (model.colorBy !== 'syri') {
    return null
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mx: 1 }}>
      {syriLegendItems.map(item => (
        <Box
          key={item.label}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}
        >
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
