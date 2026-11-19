import Tooltip from '@mui/material/Tooltip'
import { observer } from 'mobx-react'

import type { TooltipProps } from '@mui/material/Tooltip'

// A disabled control has pointer-events:none, so a Tooltip placed directly on
// it never fires; the span wrapper (per MUI guidance) restores the hover, and
// only a disabled control gets one, so an enabled control keeps its layout.
const MaybeTooltip = observer(function MaybeTooltip({
  title,
  disabled,
  placement,
  children,
}: {
  title?: string
  disabled?: boolean
  placement?: TooltipProps['placement']
  children: React.ReactElement
}) {
  return title ? (
    <Tooltip title={title} placement={placement}>
      {disabled ? <span>{children}</span> : children}
    </Tooltip>
  ) : (
    children
  )
})

export default MaybeTooltip
