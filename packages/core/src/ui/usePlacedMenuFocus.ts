import { useRef } from 'react'

import type { PopoverActions } from '@mui/material'

const FIRST_ROW = '[role^="menuitem"]:not(.Mui-disabled)'

/**
 * Props that move a MUI Menu's opening focus to after the menu is placed.
 *
 * MUI focuses the first row while the menu mounts, before Popover writes the
 * paper's position, so the focused row still sits at the viewport's top-left.
 * Firefox scrolls every enclosing frame to reveal a focused element, so a page
 * that embeds JBrowse in an iframe jumped to the frame's top whenever a menu
 * opened with that top scrolled out of view.
 *
 * The `onEntering` returned here places the paper through Popover's
 * `updatePosition`, then focuses the first row without scrolling anything.
 */
export function usePlacedMenuFocus() {
  const action = useRef<PopoverActions>(null)
  return {
    action,
    autoFocus: false,
    disableAutoFocus: true,
    onEntering: (paper: HTMLElement) => {
      action.current?.updatePosition()
      paper
        .querySelector<HTMLElement>(FIRST_ROW)
        ?.focus({ preventScroll: true })
    },
  }
}
