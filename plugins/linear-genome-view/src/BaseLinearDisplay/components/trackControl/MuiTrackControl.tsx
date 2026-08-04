import { useState } from 'react'

import { CascadingMenu, CascadingMenuButton } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CancelIcon from '@mui/icons-material/Cancel'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import HeightIcon from '@mui/icons-material/Height'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { Chip, IconButton, Tooltip } from '@mui/material'

import type { TrackControlIcon, TrackControlProps } from './types.ts'

// JBrowse's own look for an ambient track control, and the only reason a stock
// display's corner pulls Material UI. `plainTrackControl` is the same contract
// with no toolkit; `TrackControl` picks between them.

const ICONS = {
  height: HeightIcon,
  isoform: UnfoldLessIcon,
  filter: FilterAltIcon,
} satisfies Record<TrackControlIcon, unknown>

// The one selector a test can use to press the (×) on either implementation.
// MUI draws it as an svg inside the chip and the plain set as a sibling button,
// so there is no structural handle that finds both.
const DISMISS_TESTID = 'track-control-dismiss'

const useStyles = makeStyles()(theme => ({
  // Subtle bordered look for the icon-button form, so the always-present
  // controls read as one quiet system rather than a row of bright buttons.
  button: {
    padding: 2,
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 3,
    '& svg': {
      fontSize: 14,
    },
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
  warning: {
    borderColor: theme.palette.warning.main,
    color: theme.palette.warning.main,
  },
  // The chip floats over the rendered canvas, so it needs an opaque background —
  // features showing through the label made it hard to read.
  chip: {
    background: theme.palette.background.paper,
    '&:hover': {
      background: theme.palette.action.hover,
    },
  },
}))

// The chip sits on the display's bottom edge, so its menu opens upward (the
// menu's bottom-left corner anchored to the chip's top-left).
const anchorOrigin = { vertical: 'top', horizontal: 'left' } as const
const transformOrigin = { vertical: 'bottom', horizontal: 'left' } as const

function menuItemsFor(options: TrackControlProps['options']) {
  return (options ?? []).map(option => ({
    label: option.label,
    type: 'radio' as const,
    checked: option.selected,
    // Picking from an ambient corner control is a one-shot choice, not a
    // setting worth dwelling on like the track menu's radio group — dismiss
    // like an action instead of taking CascadingMenu's radio default.
    keepMenuOpen: false,
    onClick: option.onSelect,
  }))
}

export default function MuiTrackControl({
  icon,
  tooltip,
  label,
  options,
  onClick,
  onDelete,
  warning,
}: TrackControlProps) {
  const { classes, cx } = useStyles()
  // anchor for the chip form's menu; the icon-button form lets
  // CascadingMenuButton own its own anchoring
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)
  const Icon = ICONS[icon]

  if (label === undefined) {
    return options ? (
      <CascadingMenuButton
        size="small"
        className={cx(classes.button, warning && classes.warning)}
        stopPropagation
        tooltip={tooltip}
        menuItems={menuItemsFor(options)}
      >
        <Icon />
      </CascadingMenuButton>
    ) : (
      <Tooltip title={tooltip}>
        <IconButton
          size="small"
          className={cx(classes.button, warning && classes.warning)}
          onClick={event => {
            event.stopPropagation()
            onClick?.()
          }}
        >
          <Icon />
        </IconButton>
      </Tooltip>
    )
  }

  return (
    <>
      <Tooltip title={tooltip}>
        <Chip
          size="small"
          variant="outlined"
          className={cx(classes.chip, warning && classes.warning)}
          icon={<Icon />}
          label={label}
          onClick={
            options
              ? event => {
                  // don't let the click bubble to the track/view (drag-select,
                  // deselect)
                  event.stopPropagation()
                  setAnchorEl(event.currentTarget)
                }
              : onClick
          }
          onDelete={onDelete}
          // Chip's own delete icon, re-passed only to carry the testid both
          // implementations answer to (see plainTrackControl).
          deleteIcon={<CancelIcon data-testid={DISMISS_TESTID} />}
        />
      </Tooltip>
      {options ? (
        <CascadingMenu
          open={Boolean(anchorEl)}
          anchorEl={anchorEl}
          anchorOrigin={anchorOrigin}
          transformOrigin={transformOrigin}
          onClose={() => {
            setAnchorEl(null)
          }}
          onMenuItemClick={callback => {
            callback()
          }}
          menuItems={menuItemsFor(options)}
        />
      ) : null}
    </>
  )
}
