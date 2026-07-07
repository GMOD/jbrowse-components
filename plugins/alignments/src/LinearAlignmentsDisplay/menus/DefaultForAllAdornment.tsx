import { makeStyles } from '@jbrowse/core/util/tss-react'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { ToggleButton, Tooltip } from '@mui/material'

const useStyles = makeStyles()(theme => ({
  // compact enough to sit inline with the value check: drop the default
  // ToggleButton border/padding so it's ~icon-sized, but keep the selected
  // background tint (an unmistakable on/off signal, unlike a hollow-vs-filled
  // icon alone)
  button: {
    border: 0,
    padding: theme.spacing(0.25),
  },
}))

// Trailing "default for all tracks" control for a promotable setting, rendered
// as a menu item's `endAdornment` to the right of the value check. A real MUI
// ToggleButton (native button a11y + a clear selected background) with a pin —
// distinct from the value checkbox — reads as "pinned as the default":
// unselected = outline pin, selected = filled pin on an accent-tinted button.
// Always shown so the capability is discoverable. stopPropagation keeps the
// click from toggling the row value or dismissing the menu.
export function DefaultForAllAdornment({
  isDefault,
  onToggleDefault,
}: {
  isDefault: boolean
  onToggleDefault: () => void
}) {
  const { classes } = useStyles()
  return (
    <Tooltip
      title={
        isDefault
          ? 'Default for all alignments tracks (click to clear)'
          : 'Make this the default for all alignments tracks'
      }
    >
      <ToggleButton
        className={classes.button}
        value="default"
        selected={isDefault}
        color="primary"
        size="small"
        aria-label="default for all tracks"
        onChange={e => {
          e.stopPropagation()
          onToggleDefault()
        }}
      >
        {isDefault ? (
          <PushPinIcon fontSize="small" />
        ) : (
          <PushPinOutlinedIcon fontSize="small" />
        )}
      </ToggleButton>
    </Tooltip>
  )
}
