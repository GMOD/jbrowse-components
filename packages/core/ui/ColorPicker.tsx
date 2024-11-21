import React, { useState } from 'react'
import { colord } from '@jbrowse/core/util/colord'
import { Popover, Select, MenuItem, TextField } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import * as paletteColors from './colors'
import { useLocalStorage, useDebounce } from '../util'

// we are using a vendored copy of react-colorful because the default uses
// pure-ESM which is difficult to make pass with jest e.g.
// https://stackoverflow.com/questions/58613492/how-to-resolve-cannot-use-import-statement-outside-a-module-in-jest
import { RgbaStringColorPicker } from './react-colorful'

const useStyles = makeStyles()({
  picker: { position: 'relative' },

  swatches: {
    display: 'flex',
    padding: 12,
    flexWrap: 'wrap',
  },
  swatch: {
    width: 24,
    height: 24,
    margin: 4,
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    outline: 'none',
  },
})

type PaletteType = keyof typeof paletteColors

export const PopoverPicker = ({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  const { classes } = useStyles()

  return (
    <div className={classes.picker}>
      <div
        className={classes.swatch}
        style={{ backgroundColor: color }}
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      />
      <ColorPopover
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null)
        }}
        color={color}
        onChange={onChange}
      />
    </div>
  )
}

export function ColorPopover({
  anchorEl,
  onChange,
  onClose,
  color,
}: {
  color: string
  anchorEl: HTMLElement | null
  onChange: (val: string) => void
  onClose: () => void
}) {
  return (
    <Popover open={!!anchorEl} anchorEl={anchorEl} onClose={onClose}>
      <ColorPicker color={color} onChange={onChange} />
    </Popover>
  )
}

export function ColorPicker({
  onChange,
  color,
}: {
  color: string
  onChange: (val: string) => void
}) {
  const { classes } = useStyles()
  const [val, setVal] = useLocalStorage('colorPickerPalette', 'set1')
  const presetColors = paletteColors[val as keyof typeof paletteColors]
  const palettes = Object.keys(paletteColors)
  const [text, setText] = useState(color)
  const rgb = colord(color).toRgbString()
  const rgbDebounced = useDebounce(rgb, 1000)

  const handleChange = (val: string) => {
    setText(val)
    try {
      onChange(colord(val).toRgbString())
    } catch (e) {}
  }
  return (
    <div style={{ display: 'flex', padding: 10 }}>
      <div style={{ width: 200, margin: 5 }}>
        <RgbaStringColorPicker color={rgbDebounced} onChange={handleChange} />
      </div>
      <div style={{ width: 200, margin: 5 }}>
        <Select
          value={val}
          onChange={event => {
            const pal = event.target.value as PaletteType
            setVal(pal)
          }}
        >
          {palettes.map(p => (
            <MenuItem value={p} key={p}>
              {p}
            </MenuItem>
          ))}
        </Select>

        <div className={classes.swatches}>
          {presetColors.map((presetColor, idx) => (
            <button
              type="button"
              /* biome-ignore lint/suspicious/noArrayIndexKey: */
              key={`${presetColor}-${idx}`}
              className={classes.swatch}
              style={{ background: presetColor }}
              onClick={() => {
                handleChange(presetColor)
              }}
            />
          ))}
        </div>
        <TextField
          helperText={'Manually set color (hex, rgb, or css color name)'}
          value={text}
          onChange={event => {
            handleChange(event.target.value)
          }}
        />
      </div>
    </div>
  )
}

export default PopoverPicker
