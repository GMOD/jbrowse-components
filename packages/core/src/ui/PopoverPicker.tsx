import { useState } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import { ColorPopover } from './ColorPicker.tsx'

const useStyles = makeStyles()({
  picker: { position: 'relative' },
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

export default function PopoverPicker({
  color,
  onChange,
  presetAlpha,
}: {
  color: string
  onChange: (color: string) => void
  presetAlpha?: number
}) {
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
        presetAlpha={presetAlpha}
      />
    </div>
  )
}
