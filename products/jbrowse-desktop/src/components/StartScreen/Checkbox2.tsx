import { Checkbox, FormControlLabel } from '@mui/material'

export default function Checkbox2({
  checked,
  disabled,
  label,
  onChange,
  className,
}: {
  checked: boolean
  disabled?: boolean
  label: React.ReactNode
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  className?: string
}) {
  return (
    <FormControlLabel
      className={className}
      disabled={disabled}
      label={label}
      control={<Checkbox checked={checked} onChange={onChange} />}
    />
  )
}
