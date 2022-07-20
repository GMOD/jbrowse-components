import React, { lazy, useState } from 'react'
import { observer } from 'mobx-react'
import { TextField } from '@mui/material'
import { Color, RGBColor } from 'react-color'

const ColorPicker = lazy(() => import('@jbrowse/core/ui/ColorPicker'))

// this is needed because passing a entire color object into the react-color
// for alpha, can't pass in an rgba string for example
function serializeColor(color: Color) {
  if (color instanceof Object) {
    const { r, g, b, a } = color as RGBColor
    return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`
  }
  return color
}

export const ColorSlot = (props: {
  value: string
  label?: string
  TextFieldProps?: {
    helperText: string
    fullWidth: boolean
  }
  onChange: (arg: string) => void
}) => {
  const { value = '#000', label = '', TextFieldProps = {}, onChange } = props
  const [displayed, setDisplayed] = useState(false)

  return (
    <div style={{ display: 'flex' }}>
      <TextField
        value={value}
        label={label}
        onClick={() => setDisplayed(!displayed)}
        onChange={event => onChange(event.target.value)}
        {...TextFieldProps}
      />
      <div style={{ marginTop: 10 }}>
        <React.Suspense fallback={<div />}>
          <ColorPicker
            color={value}
            onChange={event => onChange(serializeColor(event))}
          />
        </React.Suspense>
      </div>
    </div>
  )
}

function ColorEditorSlot(props: {
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
      onChange={color => slot.set(color)}
      TextFieldProps={{
        helperText: slot.description,
        fullWidth: true,
      }}
    />
  )
}

export default observer(ColorEditorSlot)
