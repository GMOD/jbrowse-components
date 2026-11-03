import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material'
import { observer } from 'mobx-react'

const RadioSelector = observer(function RadioSelector<T extends string>({
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
          const picked = options.find(o => o === event.target.value)
          if (picked !== undefined) {
            onChange(picked)
          }
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
})

export default RadioSelector
