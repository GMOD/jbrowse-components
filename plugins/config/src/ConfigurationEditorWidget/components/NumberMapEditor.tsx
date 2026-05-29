import { FormHelperText, InputLabel } from '@mui/material'
import { observer } from 'mobx-react'

import MapEntryCard, { MapAddCard } from './MapEntryCard.tsx'
import NumberEditor from './NumberEditor.tsx'

const NumberMapEditor = observer(function NumberMapEditor({
  slot,
}: {
  slot: {
    name: string
    value: Map<string, number>
    remove: (key: string) => void
    add: (key: string, val: number) => void
    description: string
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
          <NumberEditor
            slot={{
              value: val,
              set: val => {
                slot.add(key, val)
              },
            }}
          />
        </MapEntryCard>
      ))}
      <MapAddCard
        onAdd={key => {
          slot.add(key, 0)
        }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default NumberMapEditor
