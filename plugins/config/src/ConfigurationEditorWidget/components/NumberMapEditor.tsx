import { observer } from 'mobx-react'

import MapSlotEditor from './MapSlotEditor.tsx'
import NumberEditor from './NumberEditor.tsx'

const NumberMapEditor = observer(function NumberMapEditor({
  slot,
}: {
  slot: {
    name: string
    value: Map<string, number>
    set: (val: Record<string, number>) => void
    description: string
  }
}) {
  return (
    <MapSlotEditor<number>
      name={slot.name}
      description={slot.description}
      entries={[...slot.value]}
      emptyValue={0}
      setMap={val => {
        slot.set(val)
      }}
      renderValue={(val, set) => (
        <NumberEditor slot={{ value: val, set }} />
      )}
    />
  )
})

export default NumberMapEditor
