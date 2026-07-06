import { makeStyles } from '@jbrowse/core/util/tss-react'
import CheckBoxIcon from '@mui/icons-material/CheckBox'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import { Typography } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    cursor: 'pointer',
  },
  // Mirror MenuItemEndDecoration exactly (padding:0, margin:0, height:16 around a
  // default-size icon) so this box lines up pixel-for-pixel with the native
  // value check that follows it on the same row — a MUI Checkbox centers its
  // icon differently and rode ~2px high.
  iconBox: {
    padding: 0,
    margin: 0,
    height: 16,
  },
}))

// Trailing "default for all tracks" control for a promotable setting, rendered
// as a menu item's `endAdornment` so the value stays a first-class native
// checkbox row (hover, sizing, keyboard nav all inherited). stopPropagation
// keeps a click here from toggling the row's value or dismissing the menu.
export function DefaultForAllAdornment({
  isDefault,
  onToggleDefault,
}: {
  isDefault: boolean
  onToggleDefault: () => void
}) {
  const { classes } = useStyles()
  return (
    <span
      role="checkbox"
      aria-checked={isDefault}
      aria-label="default for all tracks"
      tabIndex={0}
      className={classes.root}
      onClick={e => {
        e.stopPropagation()
        onToggleDefault()
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onToggleDefault()
        }
      }}
    >
      <Typography variant="caption" color="textSecondary">
        default for all
      </Typography>
      <span className={classes.iconBox}>
        {isDefault ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon color="action" />}
      </span>
    </span>
  )
}
