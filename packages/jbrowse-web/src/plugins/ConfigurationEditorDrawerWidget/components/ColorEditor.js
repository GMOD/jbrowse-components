import React, { Component } from 'react'
import { observer, inject } from 'mobx-react'
import ReactPropTypes from 'prop-types'

import 'rc-color-picker/assets/index.css'

import ColorPicker from 'rc-color-picker'

@observer
@inject('classes')
class ColorEditor extends Component {
  static propTypes = {
    slot: ReactPropTypes.shape({
      value: ReactPropTypes.string.isRequired,
      set: ReactPropTypes.func.isRequired,
    }).isRequired,
  }

  onPickerChange = ({ color, alpha }) => {
    this.props.slot.set(color)
  }

  onTextChange = value => {
    this.props.slot.set(value)
  }

  render() {
    const { slot } = this.props
    return (
      <div>
        <input type="text" value={slot.value} onChange={this.onTextChange} />
        <ColorPicker
          animation="slide-up"
          color={slot.value}
          onChange={this.onPickerChange}
          defaultColor="#000"
        />
      </div>
    )
  }
}

export default ColorEditor
