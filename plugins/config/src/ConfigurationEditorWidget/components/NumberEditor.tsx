import { useState } from 'react'

import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

// The field holds a draft only while focused, so an in-progress "-" or "1."
// survives typing, and an undo or a menu write shows once focus leaves.
/** #slotEditor numeric text field */
const NumberEditor = observer(function NumberEditor({
  slot,
  integer = false,
}: {
  slot: {
    name?: string
    value: number | undefined
    description?: string
    set: (val: number) => void
  }
  integer?: boolean
}) {
  const [draft, setDraft] = useState<string>()
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      value={draft ?? (slot.value === undefined ? '' : String(slot.value))}
      onChange={evt => {
        const v = evt.target.value
        setDraft(v)
        const num = Number(v)
        const valid = integer ? Number.isInteger(num) : Number.isFinite(num)
        if (v !== '' && valid) {
          slot.set(num)
        }
      }}
      onBlur={() => {
        setDraft(undefined)
      }}
    />
  )
})

export default NumberEditor
