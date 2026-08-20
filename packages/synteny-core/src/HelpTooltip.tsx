import HelpIcon from '@mui/icons-material/Help'
import { Tooltip } from '@mui/material'

// Help icon + tooltip used inside settings popover rows. Sits in the row grid's
// trailing column so icons line up in a consistent column across rows. Renders
// nothing when there is no help text.
//
// `pre-line` so help composed one line per option keeps those lines: collapsed
// into a paragraph, option descriptions read as one run-on sentence. A single-
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
