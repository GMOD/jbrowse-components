import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import {
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_FONT_WEIGHT,
  GROUP_LABEL_HEIGHT,
  GROUP_LABEL_ICON_SIZE,
  GROUP_LABEL_INSET_X,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
  GROUP_LABEL_TINT,
} from './groupLabelStyle.ts'

function wash(textColor: string, amount: number) {
  const tint = alpha(textColor, amount)
  return `linear-gradient(${tint}, ${tint})`
}

const unstyledButton = {
  display: 'flex',
  alignItems: 'center',
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  pointerEvents: 'auto' as const,
}

/**
 * The on-screen section chip row: a divider above each section after the
 * first, a `controls` row holding the pills, and inside a pill either a
 * `toggle` button or the bare label, then an optional `hide` ×.
 */
export const useGroupLabelStyles = makeStyles()(theme => {
  const pill = {
    display: 'flex',
    alignItems: 'center',
    // The same constant the section layout reserves per labelled section, so a
    // chip can never outgrow the space left for it.
    height: GROUP_LABEL_HEIGHT,
    padding: `0 ${GROUP_LABEL_PADDING_X}px`,
    fontSize: GROUP_LABEL_FONT_SIZE,
    fontWeight: GROUP_LABEL_FONT_WEIGHT,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    backgroundImage: wash(theme.palette.text.primary, GROUP_LABEL_TINT),
    borderRadius: GROUP_LABEL_RADIUS,
    whiteSpace: 'nowrap' as const,
    userSelect: 'none' as const,
  }
  return {
    divider: {
      position: 'absolute' as const,
      left: 0,
      right: 0,
      height: 1,
      background: theme.palette.divider,
      pointerEvents: 'none' as const,
      zIndex: 6,
    },
    controls: {
      position: 'absolute' as const,
      left: GROUP_LABEL_INSET_X,
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      zIndex: 6,
      // The row is only as wide as its chips, but it still sits over the left
      // edge of the band; without this the gap around the chips swallowed the
      // hover there. The buttons take pointer events back.
      pointerEvents: 'none' as const,
    },
    pill,
    pillButton: {
      ...unstyledButton,
      ...pill,
      '&:hover': {
        backgroundImage: wash(theme.palette.text.primary, GROUP_LABEL_TINT * 2),
      },
    },
    toggle: {
      ...unstyledButton,
      marginLeft: -3,
    },
    hide: {
      ...unstyledButton,
      marginLeft: 2,
      marginRight: -4,
      color: theme.palette.text.secondary,
      '&:hover': {
        color: theme.palette.text.primary,
      },
    },
    icon: {
      fontSize: GROUP_LABEL_ICON_SIZE,
    },
    hideIcon: {
      fontSize: 12,
    },
  }
})
