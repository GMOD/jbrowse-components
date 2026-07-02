import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material'

/**
 * The None / Existing track / New track radio group shared by the linear
 * synteny and dotplot import forms, plus any extension-registered options.
 * Controlled: `choice`/`onChange` come from useImportFormSyntenyChoice.
 */
export default function ImportFormSyntenyChoiceRadioGroup({
  choice,
  onChange,
  customOptions,
  label,
}: {
  choice: string
  onChange: (val: string) => void
  customOptions: { value: string; label: string }[]
  label?: string
}) {
  return (
    <FormControl>
      {label ? <FormLabel id="group-label">{label}</FormLabel> : null}
      <RadioGroup
        row
        value={choice}
        onChange={event => {
          onChange(event.target.value)
        }}
        aria-label={label ? undefined : 'Synteny track source'}
        aria-labelledby={label ? 'group-label' : undefined}
      >
        <FormControlLabel value="none" control={<Radio />} label="None" />
        <FormControlLabel
          value="tracklist"
          control={<Radio />}
          label="Existing track"
        />
        <FormControlLabel
          value="custom"
          control={<Radio />}
          label="New track"
        />
        {customOptions.map(opt => (
          <FormControlLabel
            key={opt.value}
            value={opt.value}
            control={<Radio />}
            label={opt.label}
          />
        ))}
      </RadioGroup>
    </FormControl>
  )
}
