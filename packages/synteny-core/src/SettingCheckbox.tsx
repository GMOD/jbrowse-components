import { Checkbox, FormControlLabel, Typography } from '@mui/material'

import HelpTooltip from './HelpTooltip.tsx'

// Checkbox row of a synteny/dotplot settings popover. Uses the same 3-column
// grid as SettingRow: the checkbox+label span the label/control columns and the
// help icon lands in the shared trailing column, aligned with other rows.
export default function SettingCheckbox({
  label,
  help,
  checked,
  onChange,
}: {
  label: string
  help?: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '96px 1fr auto',
        alignItems: 'center',
        columnGap: 8,
        minHeight: 28,
      }}
    >
      <FormControlLabel
        style={{ gridColumn: '1 / 3', margin: 0 }}
        control={
          <Checkbox
            checked={checked}
            onChange={() => {
              onChange()
            }}
            size="small"
          />
        }
        label={<Typography variant="body2">{label}</Typography>}
      />
      <HelpTooltip help={help} />
    </div>
  )
}
