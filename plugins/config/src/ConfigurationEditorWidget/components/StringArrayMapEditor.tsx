import { observer } from 'mobx-react'

import MapSlotEditor from './MapSlotEditor.tsx'
import StringArrayEditor from './StringArrayEditor.tsx'

const StringArrayMapEditor = observer(function StringArrayMapEditor({
  slot,
}: {
  slot: {
    name: string
    value: Map<string, string[]>
    set: (val: Record<string, string[]>) => void
    description: string
  }
}) {
  return (
    <MapSlotEditor<string[]>
      name={slot.name}
      description={slot.description}
      // deep copy so per-entry edits never reuse the live MST array nodes
      entries={[...slot.value].map(([k, v]) => [k, [...v]])}
      emptyValue={[]}
      setMap={val => {
        slot.set(val)
      }}
      renderValue={(val, set, key) => (
        <StringArrayEditor
          slot={{
            name: '',
            value: val,
            description: `Values associated with entry ${key}`,
            set,
          }}
        />
      )}
    />
  )
})

export default StringArrayMapEditor
