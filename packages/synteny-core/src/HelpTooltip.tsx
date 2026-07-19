import HelpIcon from '@mui/icons-material/Help'
import { Tooltip } from '@mui/material'

// Help icon + tooltip used inside settings popover rows. Sits in the row grid's
// trailing column so icons line up in a consistent column across rows. Renders
// nothing when there is no help text.
export default function HelpTooltip({ help }: { help?: string }) {
  return help ? (
    <Tooltip title={help} arrow>
      <HelpIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
    </Tooltip>
  ) : null
}
