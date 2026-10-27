import { LabeledCheckbox } from '@jbrowse/core/ui'
import { FormControl, FormHelperText, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

const choices = [
  ['', 'default'],
  ['true', 'on'],
  ['false', 'off'],
] as const

// An unset `maybeBoolean` defers to whoever reads it, which may draw it on,
// so it gets a three-way choice rather than a checkbox that reads unset as off.
/** #slotEditor checkbox, or a default/on/off dropdown for `maybeBoolean` */
const BooleanEditor = observer(function BooleanEditor({
  slot,
}: {
  slot: {
    name: string
    type: string
    value: boolean | undefined
    set: (arg: boolean | undefined) => void
    description: string
  }
}) {
  return slot.type === 'maybeBoolean' ? (
    <ConfigurationTextField
      select
      slotProps={{
        select: { displayEmpty: true },
        inputLabel: { shrink: true },
      }}
      label={slot.name}
      helperText={slot.description}
      value={slot.value === undefined ? '' : String(slot.value)}
      onChange={evt => {
        const { value } = evt.target
        slot.set(value === '' ? undefined : value === 'true')
      }}
    >
      {choices.map(([value, label]) => (
        <MenuItem key={value} value={value}>
          {value === '' ? <em>{label}</em> : label}
        </MenuItem>
      ))}
    </ConfigurationTextField>
  ) : (
    <FormControl>
      <LabeledCheckbox
        label={slot.name}
        checked={!!slot.value}
        onChange={val => {
          slot.set(val)
        }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )
})

export default BooleanEditor
