import { Suspense, lazy } from 'react'

import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

const PopoverPicker = lazy(() =>
  import('@jbrowse/core/ui/ColorPicker').then(m => ({
    default: m.PopoverPicker,
  })),
)

const ColorEditor = observer(function ColorEditor(props: {
  slot: {
    name: string
    value: string
    description: string
    set: (arg: string) => void
  }
}) {
  const { slot } = props
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <TextField
        value={slot.value}
        label={slot.name}
        helperText={slot.description}
        style={{ flex: 1, minWidth: 0 }}
        onChange={event => {
          slot.set(event.target.value)
        }}
      />
      <Suspense fallback={null}>
        <PopoverPicker
          color={slot.value}
          onChange={color => {
            slot.set(color)
          }}
        />
      </Suspense>
    </div>
  )
})

export default ColorEditor
