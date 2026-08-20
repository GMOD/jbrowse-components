import HelpIcon from '@mui/icons-material/Help'
import { Tooltip } from '@mui/material'

// Help icon + tooltip for a labelled field in a dialog or form row — the
// synteny launch dialog's options are what it draws. Renders nothing when there
// is no help text. A MENU row's help is not this: it is `helpText` on the item,
// which `CascadingMenu` draws as a "?" opening a dialog.
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
