import HelpIcon from '@mui/icons-material/Help'
import { Tooltip } from '@mui/material'

// Help icon + tooltip used inside settings popover rows. Sits in the row grid's
// trailing column so icons line up in a consistent column across rows. Renders
// nothing when there is no help text.
//
// `pre-line` so a row whose control is a dropdown can give one line per option:
// the menu form of such a setting hangs its own help off each option row, and
// collapsed into a paragraph those read as one run-on sentence. A single-
// paragraph string is unaffected — it has no newlines to honour.
export default function HelpTooltip({ help }: { help?: string }) {
  return help ? (
    <Tooltip
      title={help}
      arrow
      slotProps={{ tooltip: { sx: { whiteSpace: 'pre-line' } } }}
    >
      <HelpIcon sx={{ fontSize: '0.875rem', color: 'text.secondary' }} />
    </Tooltip>
  ) : null
}
