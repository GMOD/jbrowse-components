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
    set: (val: Record<string, number>) => void
    description: string
  }
}) {
  const entries = [...slot.value]
  const obj = Object.fromEntries(entries)
  return (
    <>
      <InputLabel>{slot.name}</InputLabel>
      {entries.map(([key, val]) => (
        <MapEntryCard
          key={key}
          title={key}
          onDelete={() => {
            const { [key]: _omit, ...rest } = obj
            slot.set(rest)
          }}
        >
          <NumberEditor
            slot={{
              value: val,
              set: val => {
                slot.set({ ...obj, [key]: val })
              },
            }}
          />
        </MapEntryCard>
      ))}
      <MapAddCard
        onAdd={key => {
          slot.set({ ...obj, [key]: 0 })
        }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

export default NumberMapEditor
