import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha } from '@mui/material'

import {
  GROUP_LABEL_BG_OPACITY,
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_HEIGHT,
  GROUP_LABEL_ICON_SIZE,
  GROUP_LABEL_INSET_X,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
} from './groupLabelStyle.ts'

/**
 * #api display-kit
 * The on-screen section chip row: a divider above each section after the
 * first, a `controls` row holding the chips, and the chip itself as a `button`
 * or a plain `label`.
 */
export const useGroupLabelStyles = makeStyles()(theme => {
  const chip = {
    display: 'flex',
    alignItems: 'center',
    padding: `0 ${GROUP_LABEL_PADDING_X}px`,
    fontSize: GROUP_LABEL_FONT_SIZE,
    // The same constant the section layout reserves per labelled section, so a
    // chip can never outgrow the space left for it.
    height: GROUP_LABEL_HEIGHT,
    color: theme.palette.text.secondary,
    background: alpha(theme.palette.background.paper, GROUP_LABEL_BG_OPACITY),
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
      gap: 2,
      zIndex: 6,
      // The row is only as wide as its chips, but it still sits over the left
      // edge of the band; without this the gap around the chips swallowed the
      // hover there. The chips take pointer events back below.
      pointerEvents: 'none' as const,
    },
    button: {
      ...chip,
      cursor: 'pointer',
      border: 'none',
      pointerEvents: 'auto' as const,
      '&:hover': {
        background: theme.palette.background.paper,
      },
    },
    label: chip,
    icon: {
      fontSize: GROUP_LABEL_ICON_SIZE,
    },
  }
})
