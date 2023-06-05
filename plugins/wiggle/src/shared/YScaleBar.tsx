import React from 'react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { axisPropsFromTickScale, Axis, LEFT, RIGHT } from 'react-d3-axis-mod'

type Ticks = ReturnType<typeof axisPropsFromTickScale>

export default observer(function YScaleBar({
  model,
  orientation,
}: {
  model: { ticks?: Ticks }
  orientation?: string
}) {
  const { ticks } = model
  const theme = useTheme()
  return ticks ? (
    <Axis
      {...ticks}
      shadow={2}
      format={(n: number) => n}
      style={{ orient: orientation === 'left' ? LEFT : RIGHT }}
      bg={theme.palette.background.default}
      fg={theme.palette.text.primary}
    />
  ) : null
})
