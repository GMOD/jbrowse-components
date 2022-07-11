import React from 'react'
import { HexColorPicker } from 'react-colorful'

// based on https://codesandbox.io/s/bekry?file=/src/SwatchesPicker.js from
// react-colorful readme
const SwatchesPicker = ({
  color,
  onChange,
  presetColors,
}: {
  color: string
  onChange: (color: string) => void
  presetColors: string[]
}) => {
  return (
    <div className="picker">
      <HexColorPicker color={color} onChange={onChange} />

      <div className="picker__swatches">
        {presetColors.map(presetColor => (
          <button
            key={presetColor}
            className="picker__swatch"
            style={{ background: presetColor }}
            onClick={() => onChange(presetColor)}
          />
        ))}
      </div>
    </div>
  )
}

export default SwatchesPicker
