import HelpIcon from '@mui/icons-material/Help'
import { Checkbox, FormControlLabel, Tooltip, Typography } from '@mui/material'

// Checkbox row used inside synteny/dotplot settings popovers. Optional help
// tooltip renders an inline help icon next to the label.
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
    <FormControlLabel
      control={
        <Checkbox
          checked={checked}
          onChange={() => {
            onChange()
          }}
          size="small"
        />
      }
      label={
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <Typography variant="body2">{label}</Typography>
          {help ? (
            <Tooltip title={help} arrow>
              <HelpIcon sx={{ fontSize: '0.875rem', ml: 0.5 }} />
            </Tooltip>
          ) : null}
        </span>
      }
    />
  )
}
