import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import { IconButton, Tooltip } from '@mui/material'

import { openPromotableDefaultDialog } from './openPromotableDefaultDialog.ts'
import { makeStyles } from '../util/tss-react/index.ts'

import type { SessionDefaultControl } from '../configuration/promotableDefaults.ts'

const useStyles = makeStyles()(theme => ({
  // subtle at rest so it doesn't compete with the row's value control: a muted,
  // icon-sized button. Reveals emphasis on hover; tints to the accent color only
  // when this value IS the type-wide default, so that state still reads at a
  // glance without a heavy always-on icon.
  button: {
    padding: theme.spacing(0.25),
    color: theme.palette.text.disabled,
    '&:hover': {
      color: theme.palette.text.secondary,
    },
  },
  active: {
    color: theme.palette.primary.main,
  },
}))

// Trailing control for a promotable setting, rendered as a menu item's
// `endAdornment`. Opens the manage-default dialog (apply to future / currently
// open tracks) rather than toggling inline — one deliberate click, with the
// destructive "apply to open tracks" gated behind a submit. `stopPropagation`
// keeps the click off the row value / menu dismissal. Wording says "of this type"
// because a promoted default is scoped to the display type (e.g. every
// LinearAlignmentsDisplay), not literally all tracks.
export function DefaultForAllAdornment({
  control,
  label,
}: {
  control: SessionDefaultControl
  // the setting this control manages (e.g. a preset name); names it in the
  // tooltip/aria-label so screen readers and tests can tell sibling controls apart
  label?: string
}) {
  const { classes, cx } = useStyles()
  const what = label ?? 'this'
  const isDefault = control.active
  return (
    <Tooltip
      title={
        isDefault
          ? `${what} is the default for all tracks of this type (click to manage)`
          : `Set defaults for all tracks of this type`
      }
    >
      <IconButton
        className={cx(classes.button, isDefault && classes.active)}
        size="small"
        aria-label={`manage default for ${what}`}
        aria-haspopup="dialog"
        onClick={e => {
          e.stopPropagation()
          openPromotableDefaultDialog(control, label ?? what)
        }}
      >
        <MoreHorizIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}
