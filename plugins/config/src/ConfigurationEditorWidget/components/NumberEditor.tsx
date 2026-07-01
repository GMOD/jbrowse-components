import { useState } from 'react'

import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

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
  const [val, setVal] = useState(
    slot.value === undefined ? '' : String(slot.value),
  )
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
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
