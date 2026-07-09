import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { ToggleButton, Tooltip } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

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

// Trailing "default for all tracks of this type" control for a promotable
// setting, rendered as a menu item's `endAdornment` to the right of the value
// check. A real MUI ToggleButton (native button a11y + a clear selected
// background) with a pin — distinct from the value checkbox — reads as "pinned
// as the default": unselected = outline pin, selected = filled pin on an
// accent-tinted button. Always shown so the capability is discoverable.
// stopPropagation keeps the click from toggling the row value or dismissing the
// menu. The wording says "of this type" because a promoted default is scoped to
// the display type (e.g. every LinearAlignmentsDisplay), not literally all
// tracks.
export function DefaultForAllAdornment({
  isDefault,
  onToggleDefault,
  label,
}: {
  isDefault: boolean
  onToggleDefault: () => void
  // the setting this pin promotes (e.g. a preset name); names the pin in its
  // tooltip/aria-label so screen readers and tests can tell sibling pins apart
  label?: string
}) {
  const { classes } = useStyles()
  const what = label ?? 'this'
  return (
    <Tooltip
      title={
        isDefault
          ? `${what} is the default for all tracks of this type (click to clear)`
          : `Make ${what} the default for all tracks of this type`
      }
    >
      <ToggleButton
        className={classes.button}
        value="default"
        selected={isDefault}
        color="primary"
        size="small"
        aria-label={`make ${what} the default for all tracks`}
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
