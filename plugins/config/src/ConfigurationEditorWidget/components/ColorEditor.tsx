import { Suspense, useState } from 'react'

import ColorPicker from '@jbrowse/core/ui/ColorPicker'
import { TextField } from '@mui/material'
import { observer } from 'mobx-react'

export const ColorSlot = (props: {
  value: string
  label?: string
  TextFieldProps?: {
    helperText: string
    fullWidth: boolean
  }
  onChange: (arg: string) => void
}) => {
  const { value, label = '', TextFieldProps = {}, onChange } = props
  const [displayed, setDisplayed] = useState(false)

  return (
    <div style={{ display: 'flex' }}>
      <TextField
        value={value}
        label={label}
        onClick={() => {
          setDisplayed(!displayed)
        }}
        onChange={event => {
          onChange(event.target.value)
        }}
        {...TextFieldProps}
      />
      <div style={{ marginTop: 10 }}>
        <Suspense fallback={null}>
          <ColorPicker
            color={value}
            onChange={event => {
              onChange(event)
            }}
          />
        </Suspense>
      </div>
    </div>
  )
}

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
    <ColorSlot
      label={slot.name}
      value={slot.value}
      onChange={color => {
        slot.set(color)
      }}
      TextFieldProps={{
        helperText: slot.description,
        fullWidth: true,
      }}
    />
  )
})

export default ColorEditor
