import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material'

export default function RadioSelector<T extends string>({
  label,
  value,
  options,
  getOptionLabel,
  onChange,
}: {
  label: string
  value: T
  options: readonly T[]
  getOptionLabel?: (value: T) => string
  onChange: (value: T) => void
}) {
  return (
    <FormControl>
      <FormLabel>{label}</FormLabel>
      <RadioGroup
        value={value}
        onChange={event => {
          onChange(event.target.value as T)
        }}
      >
        {options.map(option => (
          <FormControlLabel
            key={option}
            value={option}
            control={<Radio />}
            label={getOptionLabel ? getOptionLabel(option) : option}
          />
        ))}
      </RadioGroup>
    </FormControl>
  )
}
