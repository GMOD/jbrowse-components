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

// How the pin names what it acts on. Two shapes, decided by the on-value:
//
// - **A boolean on-value carries a state**, and the row's label names the
//   setting rather than a value ("Show legend", "Show soft clipping"). A pin on
//   an unchecked such row applies the setting *off*, so the value-shaped copy
//   below stated the opposite of what the click does — and then, once filled,
//   claimed the setting was on by default when it had just been turned off.
// - **Everything else IS what the label says**: a radio option ("Compact"), a
//   size row whose caller folds the value into the label ("Line width (2px)").
//
// One `typeof` rather than a flag on the row, because the two forms of
// `makePin` are exactly this distinction: a symmetric pin over a `maybeBoolean`
// slot is the only way a pin's value and its label can disagree.
function pinPredicate(onValue: unknown) {
  return typeof onValue === 'boolean'
    ? `${onValue ? 'on' : 'off'} by default`
    : 'the default'
}

// The click, which is not the state the pin draws: an outline pin applies the
// value to the open tracks, a filled one clears the default it stands for.
function pinCopy(label: string, onValue: unknown, isDefault: boolean) {
  return isDefault
    ? {
        title: `${label} is ${pinPredicate(onValue)} for all tracks of this type (click to clear)`,
        ariaLabel: `clear the default for ${label}`,
      }
    : typeof onValue === 'boolean'
      ? {
          title: `Turn ${label} ${onValue ? 'on' : 'off'} for all open tracks of this type`,
          ariaLabel: `turn ${label} ${onValue ? 'on' : 'off'} for all open tracks`,
        }
      : {
          title: `Apply ${label} to all open tracks of this type`,
          ariaLabel: `apply ${label} to all open tracks`,
        }
}

// Trailing pin for a promotable setting, rendered as a menu item's
// `endAdornment` beside the value check. A ToggleButton (native button a11y + a
// clear selected tint) with a pin — distinct from the value checkbox.
//
// **The click and the state are two different things.** One click writes the
// value into every open track of this display type and raises a snackbar
// offering to keep it as the display type's default; the filled pin means that
// default is in place, so a click on a filled pin clears it and touches no
// track. A default therefore takes two deliberate clicks, which is what it costs
// to govern every track of the type opened later (ADR-048). Always shown so the
// capability is discoverable. stopPropagation keeps the click off the row value
// / menu dismissal. "of this type" because a promoted default is scoped to the
// display type (e.g. every LinearAlignmentsDisplay), not literally all tracks.
export function PinAdornment({
  pin,
  disabled,
}: {
  pin: MenuItemPin
  disabled?: boolean
}) {
  const { classes } = useStyles()
  const { label, control } = pin
  const isDefault = control.active
  const { title, ariaLabel } = pinCopy(label, control.onValue, isDefault)
  return (
    <Tooltip title={title}>
      <span className={classes.wrapper}>
        <ToggleButton
          className={classes.button}
          value="default"
          disabled={disabled}
          selected={isDefault}
          color="primary"
          size="small"
          aria-label={ariaLabel}
          onChange={e => {
            e.stopPropagation()
            control.toggle()
          }}
        >
          {isDefault ? (
            <PushPinIcon fontSize="small" />
          ) : (
            <PushPinOutlinedIcon fontSize="small" />
          )}
        </ToggleButton>
      </span>
    </Tooltip>
  )
}
