import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import ConfigurationTextField from './ConfigurationTextField'

const NumberEditor = observer(function ({
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
  useEffect(() => {
    const num = Number.parseFloat(val)
    if (Number.isNaN(num)) {
      slot.reset?.()
    } else {
      slot.set(num)
    }
  }, [slot, val])
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      value={val}
      type="number"
      onChange={evt => {
        setVal(evt.target.value)
      }}
    />
  )
})

export default NumberEditor
