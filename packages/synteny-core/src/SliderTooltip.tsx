import { Tooltip } from '@mui/material'

import type { SliderValueLabelProps } from '@mui/material'

export default function SliderTooltip(props: SliderValueLabelProps) {
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
