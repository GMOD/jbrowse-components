import ColorPicker from 'material-ui-color-picker'
import { observer } from 'mobx-react'
import ReactPropTypes from 'prop-types'
import React, { Component } from 'react'

class ColorEditor extends Component {
  static propTypes = {
    slot: ReactPropTypes.shape({
      value: ReactPropTypes.string.isRequired,
      set: ReactPropTypes.func.isRequired,
    }).isRequired,
  }

  onPickerChange = color => {
    const { slot } = this.props
    slot.set(color)
  }

  render() {
    const { slot } = this.props
    return (
      <ColorPicker
        label={slot.name}
        name="color"
        defaultValue="#000"
        value={slot.value}
        onChange={this.onPickerChange}
        TextFieldProps={{
          helperText: slot.description,
          fullWidth: true,
          InputProps: {
            style: {
              color: slot.value,
              borderRightWidth: '25px',
              borderRightStyle: 'solid',
              borderRightColor: slot.value,
            },
          },
        }}
      />
    )
  }
}

export default observer(ColorEditor)
