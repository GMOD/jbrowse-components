import React from 'react'
import { useTheme } from '@mui/material'
import { observer } from 'mobx-react'
import { axisPropsFromTickScale, Axis, LEFT, RIGHT } from 'react-d3-axis-mod'

export default observer(function ({
  model,
  orientation,
}: {
  model: { ticks?: ReturnType<typeof axisPropsFromTickScale> }
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
