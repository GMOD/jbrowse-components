import { Menu } from '@jbrowse/core/ui'
import HighlightAltIcon from '@mui/icons-material/HighlightAlt'

import type { DotplotViewModel } from '../model.ts'
import type { Coord } from '../types.ts'
import type { DotplotInteraction } from './useDotplotInteraction.ts'

export default function SelectionContextMenu({
  model,
  interaction,
}: {
  model: DotplotViewModel
  interaction: DotplotInteraction
}) {
  const { committed, anchor, pointer, clear, setHovering } = interaction
  // unhover prevents the tooltip from sticking after the menu closes; the
  // selection itself is cleared by clear() via onMenuItemClick/onClose.
  const act = (fn: (down: Coord, up: Coord) => void) => () => {
    if (anchor && pointer) {
      fn([anchor.x, anchor.y], [pointer.x, pointer.y])
    }
    setHovering(false)
  }
  return (
    <Menu
      open={committed}
      onMenuItemClick={callback => {
        callback()
        clear()
      }}
      onClose={() => {
        clear()
      }}
      anchorReference="anchorPosition"
      anchorPosition={
        pointer
          ? { top: pointer.clientY + 50, left: pointer.clientX + 50 }
          : undefined
      }
      style={{ zIndex: 11000 }}
      menuItems={[
        {
          label: 'Zoom in',
          onClick: act((down, up) => {
            model.zoomInToMouseCoords(down, up)
          }),
        },
        {
          // same wording as the linear genome view's rubberband entry: both
          // launch a synteny view framed on the region just selected, and
          // reading as one action across the two surfaces matters more than
          // either menu's local phrasing
          label: 'Linear synteny view of selection',
          onClick: act((down, up) => {
            model.onDotplotView(down, up)
          }),
        },
        {
          label: 'Highlight region',
          icon: HighlightAltIcon,
          onClick: act((down, up) => {
            model.addHighlightFromMouseCoords(down, up)
          }),
        },
      ]}
    />
  )
}
