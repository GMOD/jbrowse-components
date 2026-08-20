import { MenuItem, Select } from '@mui/material'

import type { ElementType } from 'react'

export interface SettingOption<T extends string> {
  value: T
  label: string
  // leading icon, for an option whose label alone understates it — CIGAR 'off'
  // is the one that ships, where the mode can make overlapping blocks
  // unreadable. It renders in the closed control too, so the warning is visible
  // without opening the list.
  icon?: ElementType
}

/**
 * Dropdown for a SettingRow's control column, for a setting whose options are
 * too wordy for a `SettingToggleGroup`'s segments. Fills the column so it lines
 * up with the sliders and toggle groups around it.
 *
 * `onChange` re-reads the option out of the list rather than casting the
 * event's value, so the callback can only ever be handed a value the caller
 * offered.
 */
export default function SettingSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: readonly SettingOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <Select
      fullWidth
      size="small"
      value={value}
      inputProps={{ 'aria-label': ariaLabel }}
      sx={{ fontSize: '0.8125rem' }}
      onChange={event => {
        const picked = options.find(o => o.value === event.target.value)
        if (picked) {
          onChange(picked.value)
        }
      }}
    >
      {options.map(({ value: v, label, icon: Icon }) => (
        // the gap goes on the icon, not the row: MUI renders the selected
        // row's children into the closed control, where the row's own spacing
        // does not come with them
        <MenuItem key={v} value={v} sx={{ fontSize: '0.8125rem' }}>
          {Icon ? (
            <Icon fontSize="small" color="warning" sx={{ mr: 0.5 }} />
          ) : null}
          {label}
        </MenuItem>
      ))}
    </Select>
  )
}
