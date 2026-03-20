import { useState } from 'react'

import { observer } from 'mobx-react'

import ConfigurationTextField from './ConfigurationTextField.tsx'

const NumberEditor = observer(function NumberEditor({
  slot,
}: {
  slot: {
    name?: string
    value: string
    description?: string
    set: (val: number) => void
    reset?: () => void
  }
}) {
  const [val, setVal] = useState(slot.value)
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
        if (Number.isNaN(num)) {
          slot.reset?.()
        } else {
          slot.set(num)
        }
      }}
    />
  )
})

export default NumberEditor
