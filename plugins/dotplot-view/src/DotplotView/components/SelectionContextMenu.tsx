import { ContextMenu } from '@jbrowse/core/ui'
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
  // selection itself is cleared by clear() from onClose, which ContextMenu
  // fires ahead of the item's own callback.
  const act = (fn: (down: Coord, up: Coord) => void) => () => {
    if (anchor && pointer) {
      fn([anchor.x, anchor.y], [pointer.x, pointer.y])
    }
    setHovering(false)
  }
  return (
    <ContextMenu
      // committed AND a live pointer, so the anchor is the one value that says
      // both "the menu is open" and "here"
      anchor={committed && pointer ? pointer : undefined}
      // clear of the selection rect's corner, not just off the click: the rect
      // stays drawn behind the menu and a 12px nudge would sit on its edge
      offset={{ x: 50, y: 50 }}
      onClose={() => {
        clear()
      }}
      menuItems={[
        {
          label: 'Zoom in',
          onClick: act((down, up) => {
            model.zoomInToMouseCoords(down, up)
          }),
        },
        {
          // same wording as the linear genome view's rubberband entry (which
          // sits under its "Launch" group): both launch a synteny view framed
          // on the region just selected, and reading as one action across the
          // two surfaces matters more than either menu's local phrasing. Flat
          // here — this menu is three items and has nothing else to group with.
          label: 'Linear synteny view',
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
