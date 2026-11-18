import { useState } from 'react'

import { observer } from 'mobx-react'

import { makeStyles } from '../util/tss-react/index.ts'
import { ColorPopover } from './ColorPicker.tsx'
import { triggerSwatchStyle } from './colorSwatchStyle.ts'

const useStyles = makeStyles()(theme => ({
  picker: { position: 'relative' },
  swatch: {
    ...triggerSwatchStyle(theme.palette.tableBorder),
    cursor: 'pointer',
  },
}))

const PopoverPicker = observer(function PopoverPicker({
  color,
  onChange,
  presetAlpha,
  unset,
}: {
  color: string
  onChange: (color: string) => void
  presetAlpha?: number
  /** the color is automatic, which the swatch's hover title says */
  unset?: boolean
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>(null)
  const { classes } = useStyles()
  const isAuto = color === 'auto'
  return (
    <div className={classes.picker}>
      <div
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
