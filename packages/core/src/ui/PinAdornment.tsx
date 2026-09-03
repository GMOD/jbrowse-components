import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import { ToggleButton, Tooltip } from '@mui/material'

import { makeStyles } from '../util/tss-react/index.ts'

import type { MenuItemPin } from './MenuTypes.ts'

const useStyles = makeStyles()(theme => ({
  // compact enough to sit inline with the value check: drop the default
  // ToggleButton border/padding so it's ~icon-sized, but keep the selected
  // background tint (an unmistakable on/off signal, unlike a hollow-vs-filled
  // icon alone)
  button: {
    border: 0,
    padding: theme.spacing(0.25),
  },
  // the Tooltip listens on this rather than on the button, which fires no
  // events once the row disables it
  wrapper: {
    display: 'inline-flex',
  },
}))

// A boolean on-value is a toggle pin over a checkbox row: the copy names the
// state the click applies, and the fill mirrors the checkbox. Every other
// on-value IS what the label says — a radio option ("Compact"), a size row whose
// caller folds the value into the label ("Line width (2px)") — and there the
// fill means the value is the promoted default, so a click clears it.
//
// The aria-label carries "of this type" wherever the tooltip does: it used to
// stop at "for all open tracks", stating a wider blast radius than the control
// has.
function pinCopy(label: string, onValue: unknown, active: boolean) {
  return typeof onValue === 'boolean'
    ? {
        title: `Turn ${label} ${onValue ? 'on' : 'off'} for all open tracks of this type`,
        ariaLabel: `turn ${label} ${onValue ? 'on' : 'off'} for all open tracks of this type`,
      }
    : active
      ? {
          title: `${label} is the default for all tracks of this type (click to clear)`,
          ariaLabel: `clear the default for ${label} for all tracks of this type`,
        }
      : {
          title: `Apply ${label} to all open tracks of this type`,
          ariaLabel: `apply ${label} to all open tracks of this type`,
        }
}

// Trailing pin for a promotable setting, drawn beside the value check from the
// row's `pin` declaration (`menuItemAdornment` builds this; a row never
// constructs it, which is what keeps MUI out of the eager menu-builder graph). A
// ToggleButton (native button a11y + a clear selected tint) with a pin —
// distinct from the value checkbox.
//
// One click writes the value into every open track of this display type and
// raises a snackbar offering to keep it as the display type's default, so a
// default takes two deliberate clicks (ADR-048). Always shown so the capability
// is discoverable. stopPropagation keeps the click off the row value / menu
// dismissal. "of this type" because a promoted default is scoped to the display
// type (e.g. every LinearAlignmentsDisplay), not literally all tracks.
export function PinAdornment({
  pin,
  disabled,
}: {
  pin: MenuItemPin
  disabled?: boolean
}) {
  const { classes } = useStyles()
  const { label, control } = pin
  const { title, ariaLabel } = pinCopy(label, control.onValue, control.active)
  return (
    <Tooltip title={title}>
      <span className={classes.wrapper}>
        <ToggleButton
          className={classes.button}
          value="default"
          disabled={disabled}
          selected={control.active}
          color="primary"
          size="small"
          aria-label={ariaLabel}
          onChange={e => {
            e.stopPropagation()
            control.toggle()
          }}
        >
          {control.active ? (
            <PushPinIcon fontSize="small" />
          ) : (
            <PushPinOutlinedIcon fontSize="small" />
          )}
        </ToggleButton>
      </span>
    </Tooltip>
  )
}
