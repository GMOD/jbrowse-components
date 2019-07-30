import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import TextField from '@material-ui/core/TextField'
import { ChromePicker } from 'react-color'
import React, { useState, useEffect } from 'react'

// this is needed because passing a entire color object into the react-color
// for alpha, can't pass in an rgba string for example
function serializeColor(color) {
  if (color instanceof Object) {
    const { r, g, b, a } = color
    return `rgb(${r},${g},${b},${a})`
  }
  return color
}

export const ColorPicker = props => {
  const { value, TextFieldProps, onChange } = props
  const [color, setColor] = useState(value)
  const [displayed, setDisplayed] = useState(false)

  const c = serializeColor(color)
  useEffect(() => {
    onChange(c)
  }, [c, onChange])
  return (
    <>
      <TextField
        value={c}
        InputProps={{
          style: {
            color: c,
            borderRightWidth: '25px',
            borderRightStyle: 'solid',
            borderRightColor: c,
          },
        }}
        onClick={() => setDisplayed(!displayed)}
        onChange={event => {
          setColor(event.target.value)
        }}
        {...TextFieldProps}
      />
      {displayed ? (
        <ChromePicker
          color={color}
          onChange={event => {
            setColor(event.rgb)
          }}
        />
      ) : null}
    </>
  )
}
ColorPicker.propTypes = {
  onChange: ReactPropTypes.func.isRequired,
  TextFieldProps: ReactPropTypes.shape({}),
  value: ReactPropTypes.string,
}
ColorPicker.defaultProps = {
  value: '#000',
  TextFieldProps: {},
}

function ColorEditor(props) {
  const { slot } = props
  return (
    <ColorPicker
      label={slot.name}
      name="color"
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
}
ColorEditor.propTypes = {
  slot: ReactPropTypes.shape({
    value: ReactPropTypes.string.isRequired,
    set: ReactPropTypes.func.isRequired,
  }).isRequired,
}
export default observer(ColorEditor)
