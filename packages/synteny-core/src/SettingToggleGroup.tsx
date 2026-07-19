import { ToggleButton, ToggleButtonGroup } from '@mui/material'

// Full-width segmented control used inside synteny/dotplot settings popovers.
// Fills the row's control column so it lines up with the sliders above it.
// Exclusive selection: clicking the active button is ignored (emits null) so a
// value is always set.
export default function SettingToggleGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      size="small"
      aria-label={ariaLabel}
      value={value}
      onChange={(_event, next: T | null) => {
        if (next !== null) {
          onChange(next)
        }
      }}
    >
      {options.map(o => (
        <ToggleButton
          key={o.value}
          value={o.value}
          sx={{ py: 0.25, textTransform: 'none' }}
        >
          {o.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  )
}
