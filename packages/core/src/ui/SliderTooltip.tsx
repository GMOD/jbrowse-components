import { Tooltip } from '@mui/material'

import type { SliderValueLabelProps } from '@mui/material'

// Arrow tooltip above the thumb, used as SingleSlider's default value label so
// every slider (inline track-menu rows, synteny/dotplot popovers, the LGV zoom
// control) shows one consistent value affordance instead of MUI's default
// bubble. Callers can still override via `slots={{ valueLabel }}`.
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
