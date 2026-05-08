import { useState } from 'react'

import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

const NumberEditor = observer(function NumberEditor({
  slot,
}: {
  slot: {
    name?: string
    value: number
    description?: string
    set: (val: number) => void
  }
}) {
  const [val, setVal] = useState(String(slot.value))
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      value={val}
      type="number"
      onChange={evt => {
        const v = evt.target.value
        setVal(v)
        const num = Number.parseFloat(v)
        if (!Number.isNaN(num)) {
          slot.set(num)
        }
      }}
    />
  )
})

export default NumberEditor
