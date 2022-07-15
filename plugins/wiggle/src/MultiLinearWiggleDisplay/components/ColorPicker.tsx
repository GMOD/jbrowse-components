import React, { useState } from 'react'
import { Popover, Select, MenuItem } from '@mui/material'
import { HexColorPicker } from 'react-colorful'
import { makeStyles } from 'tss-react/mui'
import { hcl } from 'd3-color'
import { category10, set1, set2, tableau10, dark2 } from './colors'

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

function ggplotColours(n: number, h = [15, 375]) {
  const colors = []
  const diff = h[1] - h[0]
  for (let i = 0; i < n; i++) {
    const k = h[0] + (diff / n) * i
    colors.push(hcl(k, 150, 65).hex() as string)
  }
  return colors
}

const paletteColors = {
  ggplot2: ggplotColours(4),
  set1,
  set2,
  dark2,
  category10,
  tableau10,
}

export const PopoverPicker = ({
  color,
  onChange,
}: {
  color: string
  onChange: (color: string) => void
  onClose?: (color: string) => void
}) => {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)

  type PaletteType = keyof typeof paletteColors
  const [val, setVal] = useState<PaletteType>('ggplot2')
  const presetColors = paletteColors[val]
  const palettes = Object.keys(paletteColors)

  const { classes } = useStyles()

  return (
    <div className={classes.picker}>
      <div
        className={classes.swatch}
        style={{ backgroundColor: color }}
        onClick={event => setAnchorEl(event.currentTarget)}
      />

      {anchorEl && (
        <Popover
          open
          anchorEl={anchorEl}
          onClose={() => {
            setAnchorEl(null)
          }}
        >
          <div style={{ padding: 10 }}>
            <HexColorPicker color={color} onChange={onChange} />
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
                  key={presetColor + '-' + idx}
                  className={classes.swatch}
                  style={{ background: presetColor }}
                  onClick={() => onChange(presetColor)}
                />
              ))}
            </div>
          </div>
        </Popover>
      )}
    </div>
  )
}

export default PopoverPicker
