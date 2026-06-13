import { useState } from 'react'

import { colord } from '@jbrowse/core/util/colord'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { MenuItem, Popover, Select, TextField } from '@mui/material'

import { paletteColors } from './colors.ts'
import { RgbaStringColorPicker } from './react-colorful.ts'
import { useDebounce, useLocalStorage } from '../util/index.ts'

// note: we are using a vendored copy of react-colorful because the default
// uses pure-ESM which is difficult to make pass with jest e.g.
// https://stackoverflow.com/questions/58613492/how-to-resolve-cannot-use-import-statement-outside-a-module-in-jest

const useStyles = makeStyles()({
  root: {
    display: 'flex',
    padding: 10,
  },
  column: {
    width: 200,
    margin: 5,
  },
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

const palettes = Object.keys(paletteColors)

type PaletteType = keyof typeof paletteColors

function isPaletteType(s: string): s is PaletteType {
  return Object.hasOwn(paletteColors, s)
}

export function ColorPopover({
  anchorEl,
  onChange,
  onClose,
  color,
  presetAlpha,
}: {
  color: string
  anchorEl: HTMLElement | null
  onChange: (val: string) => void
  onClose: () => void
  presetAlpha?: number
}) {
  return (
    <Popover open={!!anchorEl} anchorEl={anchorEl} onClose={onClose}>
      <ColorPicker
        color={color}
        onChange={onChange}
        presetAlpha={presetAlpha}
      />
    </Popover>
  )
}

export default function ColorPicker({
  onChange,
  color,
  presetAlpha,
}: {
  color: string
  onChange: (val: string) => void
  // when set, clicking a preset swatch applies this alpha (e.g. 0.2 so
  // highlights default to translucent); the alpha slider can still override it
  presetAlpha?: number
}) {
  const { classes } = useStyles()
  const [storedPalette, setStoredPalette] = useLocalStorage(
    'colorPickerPalette',
    'set1',
  )
  // a stale localStorage value (e.g. a palette since renamed/removed) would
  // index to undefined and crash the swatch map below
  const palette = isPaletteType(storedPalette) ? storedPalette : 'set1'
  const presetColors = paletteColors[palette]
  const [text, setText] = useState(color)
  const rgb = colord(color).toRgbString()
  const rgbDebounced = useDebounce(rgb, 1000)

  const handleChange = (val: string) => {
    setText(val)
    onChange(colord(val).toRgbString())
  }
  return (
    <div className={classes.root}>
      <div className={classes.column}>
        <RgbaStringColorPicker color={rgbDebounced} onChange={handleChange} />
      </div>
      <div className={classes.column}>
        <Select
          value={palette}
          onChange={event => {
            setStoredPalette(event.target.value)
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
              // eslint-disable-next-line @eslint-react/no-array-index-key -- static color-legend swatches from a palette array
              key={`${presetColor}-${idx}`}
              className={classes.swatch}
              style={{ background: presetColor }}
              onClick={() => {
                handleChange(
                  presetAlpha === undefined
                    ? presetColor
                    : colord(presetColor).alpha(presetAlpha).toRgbString(),
                )
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
