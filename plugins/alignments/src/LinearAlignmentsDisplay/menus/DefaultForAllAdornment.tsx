import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Checkbox, Typography } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  root: {
    display: 'flex',
    alignItems: 'center',
  },
  // trim MUI Checkbox's default padding so its 24px icon lines up with the
  // native checkbox/radio decoration that follows it on the same row
  checkbox: {
    padding: theme.spacing(0.5),
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
      className={classes.root}
      onClick={e => {
        e.stopPropagation()
      }}
    >
      <Typography variant="caption" color="textSecondary">
        default for all
      </Typography>
      <Checkbox
        // neutral (non-primary) color matches the native decoration beside it
        color="default"
        className={classes.checkbox}
        checked={isDefault}
        onChange={() => {
          onToggleDefault()
        }}
      />
    </span>
  )
}
