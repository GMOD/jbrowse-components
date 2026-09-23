import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

import MapSlotEditor from './MapSlotEditor.tsx'

/** #slotEditor one card per key, each holding that key's text field */
const StringMapEditor = observer(function StringMapEditor({
  slot,
}: {
  slot: {
    name: string
    value: Map<string, string>
    set: (val: Record<string, string>) => void
    description: string
  }
}) {
  return (
    <MapSlotEditor<string>
      name={slot.name}
      description={slot.description}
      entries={[...slot.value]}
      emptyValue=""
      setMap={val => {
        slot.set(val)
      }}
      renderValue={(val, set) => (
        <TextField
          fullWidth
          value={val}
          onChange={evt => {
            set(evt.target.value)
          }}
        />
      )}
    />
  )
})

export default StringMapEditor
