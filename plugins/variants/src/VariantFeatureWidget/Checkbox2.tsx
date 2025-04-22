import { Checkbox, FormControlLabel, Typography } from '@mui/material'

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
      control={<Checkbox checked={checked} onChange={onChange} />}
      label={<Typography variant="body2">{label}</Typography>}
    />
  )
}
