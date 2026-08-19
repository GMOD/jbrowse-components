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
}))

// How the pin names what it promotes. Two shapes, decided by the on-value:
//
// - **A boolean on-value promotes a state**, and the row's label names the
//   setting rather than a value ("Show legend", "Show soft clipping"). A pin on
//   an unchecked such row promotes the setting *off*, so the value-shaped copy
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

// Trailing "default for all tracks of this type" pin for a promotable setting,
// rendered as a menu item's `endAdornment` beside the value check. A ToggleButton
// (native button a11y + a clear selected tint) with a pin — distinct from the
// value checkbox — reads as "this is the default": outline pin = not the
// default, filled pin on an accent-tinted button = the default. One click sets or
// clears it; on set, `pin.toggle` raises an "apply to open tracks" snackbar
// for any open tracks not already showing this value. Always shown so the
// capability is discoverable. stopPropagation keeps the click off the row value / menu
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
  const isDefault = control.active
  const predicate = pinPredicate(control.onValue)
  return (
    <Tooltip
      title={
        isDefault
          ? `${label} is ${predicate} for all tracks of this type (click to clear)`
          : `Make ${label} ${predicate} for all tracks of this type`
      }
    >
      <ToggleButton
        className={classes.button}
        value="default"
        disabled={disabled}
        selected={isDefault}
        color="primary"
        size="small"
        aria-label={`make ${label} ${predicate} for all tracks`}
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
    </Tooltip>
  )
}
