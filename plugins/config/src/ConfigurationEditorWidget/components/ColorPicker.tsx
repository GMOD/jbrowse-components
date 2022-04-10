import React, { useState } from 'react'
import { makeStyles } from '@mui/material/styles'
import ReactPropTypes from 'prop-types'
import { ChromePicker, Color, ColorResult } from 'react-color'

const useStyles = makeStyles({
  popover: {
    position: 'absolute',
    zIndex: 2,
  },
  cover: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
})

export function ColorPicker(props: {
  color: Color
  onChange: (color: ColorResult) => void
}) {
  const { color, onChange } = props
  const classes = useStyles()
  const [displayColorPicker, setDisplayColorPicker] = useState(true)

  const handleClose = () => {
    setDisplayColorPicker(false)
  }
  return (
    <div>
      {displayColorPicker ? (
        <div className={classes.popover}>
          <div
            role="presentation"
            className={classes.cover}
            onClick={handleClose}
          />
          <ChromePicker color={color} onChange={onChange} />
        </div>
      ) : null}
    </div>
  )
}

ColorPicker.propTypes = {
  color: ReactPropTypes.string.isRequired,
  onChange: ReactPropTypes.func.isRequired,
}

export default ColorPicker
