import { FormHelperText, InputLabel } from '@mui/material'
import { observer } from 'mobx-react'

import MapEntryCard, { MapAddCard } from './MapEntryCard.tsx'
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
  // plain deep copy so edits never reuse the live MST array nodes
  const obj = Object.fromEntries([...slot.value].map(([k, v]) => [k, [...v]]))
  return (
    <>
      <InputLabel>{slot.name}</InputLabel>
      {Object.entries(obj).map(([key, val]) => (
        <MapEntryCard
          key={key}
          title={key}
          onDelete={() => {
            const { [key]: _omit, ...rest } = obj
            slot.set(rest)
          }}
        >
          <StringArrayEditor
            slot={{
              name: slot.name,
              value: val,
              description: `Values associated with entry ${key}`,
              set: newVal => {
                slot.set({ ...obj, [key]: newVal })
              },
            }}
          />
        </MapEntryCard>
      ))}
      <MapAddCard
        onAdd={key => {
          slot.set({ ...obj, [key]: [] })
        }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default StringArrayMapEditor
