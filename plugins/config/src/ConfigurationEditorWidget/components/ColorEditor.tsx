import { Suspense, useState } from 'react'

import { ColorPicker } from '@jbrowse/core/ui/ColorPicker'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

const ColorEditor = observer(function ColorEditor(props: {
  slot: {
    name: string
    value: string
    description: string
    set: (arg: string) => void
  }
}) {
  const { slot } = props
  const [displayed, setDisplayed] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
      <TextField
        value={slot.value}
        label={slot.name}
        helperText={slot.description}
        style={{ flex: 1, minWidth: 0 }}
        onClick={() => {
          setDisplayed(!displayed)
        }}
        onChange={event => {
          slot.set(event.target.value)
        }}
      />
      <div style={{ marginTop: 10 }}>
        <Suspense fallback={null}>
          <ColorPicker
            color={slot.value}
            onChange={color => {
              slot.set(color)
            }}
          />
        </Suspense>
      </div>
    </div>
  )
})

export default ColorEditor
