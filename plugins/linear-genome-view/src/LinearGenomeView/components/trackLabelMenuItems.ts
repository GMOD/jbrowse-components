import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import PushPinIcon from '@mui/icons-material/PushPin'

import type { LinearGenomeViewModel } from '../model.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { MenuItem } from '@jbrowse/core/ui'

// Pin/unpin and reorder items for a single track. Pinning is only meaningful in
// a top-level view; the to-top/to-bottom jumps are redundant with up/down when
// there are only two tracks, so they need a third track to appear.
export function getTrackOrderSubMenu({
  view,
  track,
}: {
  view: LinearGenomeViewModel
  track: BaseTrackModel
}): MenuItem[] {
  const { isTopLevelView, tracks } = view
  const { pinned } = track
  const canMove = tracks.length > 1
  const canJump = tracks.length > 2

  return [
    ...(isTopLevelView
      ? [
          {
            label: pinned ? 'Unpin track' : 'Pin track',
            icon: PushPinIcon,
            onClick: () => {
              track.setPinned(!pinned)
            },
          },
        ]
      : []),
    ...(canJump
      ? [
          {
            label: 'Move track to top',
            icon: KeyboardDoubleArrowUpIcon,
            onClick: () => {
              view.moveTrackToTop(track.id)
            },
          },
        ]
      : []),
    ...(canMove
      ? [
          {
            label: 'Move track up',
            icon: KeyboardArrowUpIcon,
            onClick: () => {
              view.moveTrackUp(track.id)
            },
          },
          {
            label: 'Move track down',
            icon: KeyboardArrowDownIcon,
            onClick: () => {
              view.moveTrackDown(track.id)
            },
          },
        ]
      : []),
    ...(canJump
      ? [
          {
            label: 'Move track to bottom',
            icon: KeyboardDoubleArrowDownIcon,
            onClick: () => {
              view.moveTrackToBottom(track.id)
            },
          },
        ]
      : []),
  ]
}
