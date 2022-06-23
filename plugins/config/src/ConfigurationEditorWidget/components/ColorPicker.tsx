import React, { useState } from 'react'
import { makeStyles } from 'tss-react/mui'
import { ChromePicker, Color, ColorResult } from 'react-color'

const useStyles = makeStyles()({
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
  const { classes } = useStyles()
  const [displayColorPicker, setDisplayColorPicker] = useState(true)

  return (
    <div>
      {displayColorPicker ? (
        <div className={classes.popover}>
          <div
            role="presentation"
            className={classes.cover}
            onClick={() => setDisplayColorPicker(false)}
          />
          <ChromePicker color={color} onChange={onChange} />
        </div>
      ) : null}
    </div>
  )
}

export default ColorPicker
