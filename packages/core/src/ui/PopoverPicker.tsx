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
  // Signals a color that isn't explicitly set — the swatch shows the effective
  // (auto) color, dashed to distinguish it from a user-chosen value.
  unset: {
    border: '2px dashed #999',
    boxSizing: 'border-box',
  },
})

export default function PopoverPicker({
  color,
  onChange,
  presetAlpha,
  unset,
}: {
  color: string
  onChange: (color: string) => void
  presetAlpha?: number
  // When true, style the swatch as an auto/unset value (dashed border) and
  // seed the picker from a sane color if `color` is the 'auto' sentinel.
  unset?: boolean
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  const { classes, cx } = useStyles()
  const isAuto = color === 'auto'
  return (
    <div className={classes.picker}>
      <div
        className={cx(classes.swatch, unset ? classes.unset : undefined)}
        style={{ backgroundColor: isAuto ? 'transparent' : color }}
        title={unset ? 'Automatic — click to set a custom color' : undefined}
        onClick={event => {
          setAnchorEl(event.currentTarget)
        }}
      />
      <ColorPopover
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null)
        }}
        color={isAuto ? 'blue' : color}
        onChange={onChange}
        presetAlpha={presetAlpha}
      />
    </div>
  )
}
