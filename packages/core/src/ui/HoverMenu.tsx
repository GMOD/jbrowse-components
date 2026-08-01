//  this code adapted from material-ui-popup-state by Andy Edwards, MIT license
//  https://github.com/jcoreio/material-ui-popup-state/blob/9dba66241a0c25b172c93ae7d9e45a9745f138e8/LICENSE.md

import { Menu } from '@mui/material'

import type { PopoverOrigin } from '@mui/material'

// A Menu a hovering pointer can cross into: the root (which spans the viewport)
// is click-through so the gap between the opener row and the panel doesn't
// swallow the pointer, while the paper itself stays interactive.
//
// Only CascadingMenu's submenus render this, so it takes exactly what they pass
// — the root's pointer-events and the paper slot are its whole point, and a
// pass-through of the full MenuProps would let a caller quietly override them.
function HoverMenu({
  open,
  anchorEl,
  onClose,
  anchorOrigin,
  transformOrigin,
  children,
}: {
  open: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  anchorOrigin: PopoverOrigin
  transformOrigin: PopoverOrigin
  children: React.ReactNode
}) {
  return (
    <Menu
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      style={{ pointerEvents: 'none' }}
      slotProps={{ paper: { style: { pointerEvents: 'auto' } } }}
    >
      {children}
    </Menu>
  )
}

export default HoverMenu
