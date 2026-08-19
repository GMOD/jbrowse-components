import { useState } from 'react'

import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

/** #slotEditor numeric text field */
const NumberEditor = observer(function NumberEditor({
  slot,
  integer = false,
}: {
  slot: {
    name?: string
    value: number | undefined
    description?: string
    // what unset resolves to on a promotable slot, absent on a plain one
    promotedBase?: unknown
    set: (val: number) => void
  }
  integer?: boolean
}) {
  const [val, setVal] = useState(
    slot.value === undefined ? '' : String(slot.value),
  )
  // An unset `maybeNumber` is a promotable slot's inherit sentinel, and an
  // empty box is the honest rendering of it — a number field, unlike a
  // checkbox, has a state for "nothing". What it did not say is what the track
  // is therefore drawing at, so `featureHeight` read as a blank with no clue
  // that reads are 7px tall. The placeholder is that, in the affordance meant
  // for it; the label has to float for MUI to draw one over a labelled field.
  const placeholder =
    slot.value === undefined && slot.promotedBase !== undefined
      ? String(slot.promotedBase)
      : undefined
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      placeholder={placeholder}
      slotProps={placeholder ? { inputLabel: { shrink: true } } : undefined}
      value={val}
      onChange={evt => {
        const v = evt.target.value
        setVal(v)
        const num = Number(v)
        // commit only valid values; the text buffer preserves in-progress
        // entries like "-" or "1." without writing garbage to the config
        const valid = integer ? Number.isInteger(num) : Number.isFinite(num)
        if (v !== '' && valid) {
          slot.set(num)
        }
      }}
    />
  )
})

export default NumberEditor
