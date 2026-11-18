import { useState } from 'react'

import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import { ColorPopover } from './ColorPicker.tsx'
import { triggerSwatchStyle } from './colorSwatchStyle.ts'

const useStyles = makeStyles()(theme => ({
  picker: { position: 'relative' },
  swatch: {
    ...triggerSwatchStyle(theme.palette.tableBorder),
    display: 'block',
    padding: 0,
    background: 'none',
    cursor: 'pointer',
  },
}))

const PopoverPicker = observer(function PopoverPicker({
  label,
  color,
  onChange,
  presetAlpha,
  unset,
}: {
  /** what the swatch colors, which a screen reader announces */
  label: string
  color: string
  onChange: (color: string) => void
  presetAlpha?: number
  /** the color is automatic, which the swatch's hover title says */
  unset?: boolean
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const { classes } = useStyles()
  const isAuto = color === 'auto'
  return (
    <div className={classes.picker}>
      <button
        type="button"
        aria-label={label}
        className={classes.swatch}
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
})

export default PopoverPicker
