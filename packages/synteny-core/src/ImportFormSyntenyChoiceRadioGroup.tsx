import { useId } from 'react'

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
 * Controlled: `choice`/`onChange` come from useImportFormSyntenyChoices.
 *
 * Three ways to name the group, in precedence order: `labelledBy` points at a
 * heading the caller already renders (the synteny form's per-pair one, which is
 * also its live region, so the text isn't written twice); `label` renders a
 * FormLabel here; neither falls back to a generic aria-label.
 */
export default function ImportFormSyntenyChoiceRadioGroup({
  choice,
  onChange,
  customOptions,
  label,
  labelledBy,
}: {
  choice: string
  onChange: (val: string) => void
  customOptions: { value: string; label: string }[]
  label?: string
  labelledBy?: string
}) {
  // two views can have an import form open at once, and the synteny form has one
  // of these per row pair, so a fixed id would label them all from the first one
  const ownLabelId = useId()
  const named = labelledBy ?? (label ? ownLabelId : undefined)
  return (
    <FormControl>
      {label && !labelledBy ? (
        <FormLabel id={ownLabelId}>{label}</FormLabel>
      ) : null}
      <RadioGroup
        row
        value={choice}
        onChange={event => {
          onChange(event.target.value)
        }}
        aria-label={named ? undefined : 'Synteny track source'}
        aria-labelledby={named}
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
