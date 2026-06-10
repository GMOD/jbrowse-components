import { FormHelperText, InputLabel } from '@mui/material'

import MapEntryCard, { MapAddCard } from './MapEntryCard.tsx'

// shared shell for map slot editors (numberMap, stringArrayMap): a labelled
// list of per-key cards plus an "add key" card. The owning wrapper stays the
// observer and passes plain entries in, so this stays a non-observer generic
// (which keeps JSX type args working at the call sites).
export default function MapSlotEditor<V>({
  name,
  description,
  entries,
  emptyValue,
  setMap,
  renderValue,
}: {
  name: string
  description: string
  entries: [string, V][]
  emptyValue: V
  setMap: (val: Record<string, V>) => void
  renderValue: (val: V, set: (val: V) => void, key: string) => React.ReactNode
}) {
  const obj = Object.fromEntries(entries)
  return (
    <>
      <InputLabel>{name}</InputLabel>
      {entries.map(([key, val]) => (
        <MapEntryCard
          key={key}
          title={key}
          onDelete={() => {
            const { [key]: _omit, ...rest } = obj
            setMap(rest)
          }}
        >
          {renderValue(
            val,
            newVal => {
              setMap({ ...obj, [key]: newVal })
            },
            key,
          )}
        </MapEntryCard>
      ))}
      <MapAddCard
        onAdd={key => {
          setMap({ ...obj, [key]: emptyValue })
        }}
      />
      <FormHelperText>{description}</FormHelperText>
    </>
  )
}
