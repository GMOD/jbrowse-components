import { useState } from 'react'

import { CascadingMenu, CascadingMenuButton } from '@jbrowse/core/ui'
import { emphasize } from '@jbrowse/core/util/color'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import CancelIcon from '@mui/icons-material/Cancel'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import HeightIcon from '@mui/icons-material/Height'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import { Chip, IconButton, Tooltip } from '@mui/material'

import type { JBrowseStyleTheme } from '@jbrowse/core/ui/styleTheme'
import type { TrackControlIcon, TrackControlProps } from '@jbrowse/display-ui'

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

// The same for the control itself, per icon, because a display's corner can hold
// several of these and nothing else tells them apart from outside. The class
// names are tss-react hashes, and the MUI icon's own `data-testid` is stripped
// from production builds — so a figure spec pointing at the built app had
// neither handle. `aria-label` carries the tooltip, which is prose.
//
// `plainTrackControl` writes the same string by hand rather than importing this,
// since importing anything from here would drag Material UI into the module that
// exists to avoid it.
const trackControlTestId = (icon: TrackControlIcon) => `track-control-${icon}`

// `action.hover` is a translucent overlay meant to sit on a known surface. These
// controls sit on the rendered canvas, so taking it as the background let
// features show through on hover — the hover state has to stay as opaque as the
// resting one, hence emphasizing the paper color rather than veiling it.
const hoverBackground = (theme: JBrowseStyleTheme) =>
  emphasize(
    theme.palette.background.paper,
    theme.palette.action.hoverOpacity * 2,
  )

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
      background: hoverBackground(theme),
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
    // `&&` doubles the class, because Chip's own clickable hover rule carries
    // two classes and outranks a single one
    '&&:hover': {
      background: hoverBackground(theme),
    },
  },
  // The ▾ after a label whose press opens a menu — the one cue telling that
  // chip from one whose press acts. Tucked into the label's own padding so the
  // chip grows by the glyph and not by a second gap.
  caretLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    '& svg': {
      fontSize: 16,
      marginRight: -6,
    },
  },
}))

// These controls sit on the display's bottom edge, so their menu opens upward
// (the menu's bottom-left corner anchored to the control's top-left). BOTH forms
// take it: CascadingMenuButton's own default drops the menu below its trigger,
// which down here means MUI flips it back into the viewport ON TOP OF the
// control — so the icon form's menu covered the icon it came from, and nothing
// in the frame said which control had been pressed. `plainTrackControl` reaches
// the same answer in its own words, and says so at more length.
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
  onMenuClose,
  onDelete,
  warning,
}: TrackControlProps) {
  const { classes, cx } = useStyles()
  // anchor for the chip form's menu; the icon-button form lets
  // CascadingMenuButton own its own anchoring
  const [anchorEl, setAnchorEl] = useState<Element | null>(null)
  const Icon = ICONS[icon]

  const testId = trackControlTestId(icon)

  if (label === undefined) {
    return options ? (
      <CascadingMenuButton
        size="small"
        className={cx(classes.button, warning && classes.warning)}
        stopPropagation
        tooltip={tooltip}
        data-testid={testId}
        anchorOrigin={anchorOrigin}
        transformOrigin={transformOrigin}
        menuItems={menuItemsFor(options)}
      >
        <Icon />
      </CascadingMenuButton>
    ) : (
      <Tooltip title={tooltip}>
        <IconButton
          size="small"
          className={cx(classes.button, warning && classes.warning)}
          data-testid={testId}
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
          data-testid={testId}
          icon={<Icon />}
          label={
            options ? (
              <span className={classes.caretLabel}>
                {label}
                <ArrowDropDownIcon />
              </span>
            ) : (
              label
            )
          }
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
          // CascadingMenu routes a pick through here too (`onCloseRoot`), so
          // this is every way the menu closes
          onClose={() => {
            setAnchorEl(null)
            onMenuClose?.()
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
