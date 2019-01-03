import React, { Component } from 'react'
import { observer, inject } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import ColorPicker from 'material-ui-color-picker'

@observer
@inject('classes')
class ColorEditor extends Component {
  static propTypes = {
    slot: ReactPropTypes.shape({
      value: ReactPropTypes.string.isRequired,
      set: ReactPropTypes.func.isRequired,
    }).isRequired,
  }

  onPickerChange = color => {
    this.props.slot.set(color)
  }

  onTextChange = value => {
    this.props.slot.set(value)
  }

  render() {
    const { slot } = this.props
    return (
      <div style={{ position: 'relative' }}>
        <ColorPicker
          name="color"
          defaultValue="#000"
          value={slot.value}
          onChange={this.onPickerChange}
        />
        <div
          style={{
            position: 'absolute',
            left: '10.8em',
            top: 0,
            background: slot.value,
            height: '100%',
            width: '2em',
          }}
        />
      </div>
    )
  }
}

export default ColorEditor
