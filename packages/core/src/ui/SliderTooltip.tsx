import { Tooltip } from '@mui/material'

import type { SliderValueLabelProps } from '@mui/material'

// Arrow tooltip above the thumb, used as SingleSlider's default value label so
// every slider (inline track-menu rows, the settings menus' size submenus, the
// LGV zoom control) shows one consistent value affordance instead of MUI's default
// bubble. Callers can still override via `slots={{ valueLabel }}`.
//
// Unmounted while closed rather than rendered with `open={false}`. `open` is the
// Slider's own hover/drag state (it passes `open === index || active === index`),
// so nothing here is what detects the hover — a closed Tooltip only costs its
// Popper. On the LGV zoom slider, whose value tracks live `bpPerPx`, that was a
// Tooltip and a Popper re-rendering on every animation frame of a wheel zoom to
// show nothing.
export default function SliderTooltip(props: SliderValueLabelProps) {
  const { children, open, value } = props
  return open ? (
    <Tooltip open enterTouchDelay={0} placement="top" title={value} arrow>
      {children}
    </Tooltip>
  ) : (
    children
  )
}
