import { Checkbox, FormControlLabel } from '@mui/material'

export default function Checkbox2({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <FormControlLabel
      disabled={disabled}
      style={{ display: 'block' }}
      control={<Checkbox checked={checked} onChange={onChange} />}
      label={label}
    />
  )
}
