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
// Two things a caller does set: `zIndex`, which is the ROOT menu's level (a
// submenu that stays on MUI's default modal scale under a raised root ends up
// beneath that root's viewport-spanning backdrop, which then eats its clicks),
// and `onMouseEnter`, which fires on the paper rather than the click-through
// root and so means "the pointer arrived here", not "the pointer is somewhere
// over the viewport".
function HoverMenu({
  open,
  anchorEl,
  onClose,
  onMouseEnter,
  paperRef,
  anchorOrigin,
  transformOrigin,
  zIndex,
  children,
}: {
  open: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  onMouseEnter?: () => void
  // the panel's own box, which the parent list measures its aim cone against
  paperRef?: React.Ref<HTMLElement>
  anchorOrigin: PopoverOrigin
  transformOrigin: PopoverOrigin
  zIndex?: React.CSSProperties['zIndex']
  children: React.ReactNode
}) {
  return (
    <Menu
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
      transformOrigin={transformOrigin}
      style={{ pointerEvents: 'none', zIndex }}
      slotProps={{
        paper: {
          style: { pointerEvents: 'auto' },
          onMouseEnter,
          ref: paperRef,
        },
      }}
      // A submenu is portaled in the DOM but is still a React *descendant* of
      // the parent menu's list, so React replays its key events into the parent
      // MenuList's own arrow handler. That parent then moves focus to one of its
      // rows, the submenu's focus trap yanks it back to the paper, and arrow
      // navigation inside a submenu dies on its first row. The submenu's own
      // MenuList sits below this root in the real DOM and has already handled
      // the key by the time it gets here, so stopping it costs nothing.
      onKeyDown={e => {
        e.stopPropagation()
      }}
    >
      {children}
    </Menu>
  )
}

export default HoverMenu
