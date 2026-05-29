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
    remove: (key: string) => void
    add: (key: string, val: string[]) => void
    description: string
    setAtKeyIndex: (key: string, idx: number, val: string) => void
    removeAtKeyIndex: (key: string, idx: number) => void
    addToKey: (key: string, val: string) => void
  }
}) {
  return (
    <>
      <InputLabel>{slot.name}</InputLabel>
      {[...slot.value].map(([key, val]) => (
        <MapEntryCard
          key={key}
          title={key}
          onDelete={() => {
            slot.remove(key)
          }}
        >
          <StringArrayEditor
            slot={{
              name: slot.name,
              value: val,
              description: `Values associated with entry ${key}`,
              setAtIndex: (idx, val) => {
                slot.setAtKeyIndex(key, idx, val)
              },
              removeAtIndex: idx => {
                slot.removeAtKeyIndex(key, idx)
              },
              add: val => {
                slot.addToKey(key, val)
              },
            }}
          />
        </MapEntryCard>
      ))}
      <MapAddCard
        onAdd={key => {
          slot.add(key, [])
        }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default StringArrayMapEditor
