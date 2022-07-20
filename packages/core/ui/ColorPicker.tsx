import React, { useState, useMemo } from 'react'
import { Popover, Select, MenuItem, TextField } from '@mui/material'
import { HexColorPicker } from 'react-colorful'
import { makeStyles } from 'tss-react/mui'
import { hcl } from 'd3-color'
import { category10, set1, set2, tableau10, dark2 } from './colors'
import { colord, extend } from 'colord'
import namesPlugin from 'colord/plugins/names'

extend([namesPlugin])

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

function ggplotColours(n: number, h = [15, 400]) {
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
        onClick={event => setAnchorEl(event.currentTarget)}
      />
      <ColorPopover
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
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
  const { classes } = useStyles()
  const [val, setVal] = useState<PaletteType>('ggplot2')
  const presetColors = paletteColors[val]
  const palettes = Object.keys(paletteColors)

  // const rgbaString = useMemo(() => {
  //   return color.startsWith('rgba') ? color : colord(color).toRgbString()
  // }, [color])
  // console.log({ rgbaString, color })

  return (
    <Popover open={!!anchorEl} anchorEl={anchorEl} onClose={onClose}>
      <div style={{ padding: 10, display: 'flex' }}>
        <HexColorPicker color={color} onChange={onChange} />
        <div>
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
      </div>
    </Popover>
  )
}

export default PopoverPicker
