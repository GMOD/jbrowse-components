import { useState } from 'react'

import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

const IntegerEditor = observer(function IntegerEditor({
  slot,
}: {
  slot: {
    name?: string
    value: number
    description?: string
    set: (num: number) => void
  }
}) {
  const [val, setVal] = useState(String(slot.value))
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      value={val}
      onChange={evt => {
        const v = evt.target.value
        setVal(v)
        const num = Number(v)
        // commit only valid integers; the text buffer preserves in-progress
        // entries like "-" or "1." without writing garbage to the config
        if (v !== '' && Number.isInteger(num)) {
          slot.set(num)
        }
      }}
    />
  )
})

export default IntegerEditor
