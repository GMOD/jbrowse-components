import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getContainingView, getSession } from '@jbrowse/core/util'
import LowPriorityIcon from '@mui/icons-material/LowPriority'
import MoreVertIcon from '@mui/icons-material/MoreVert'

import { getTrackOrderSubMenu } from './trackLabelMenuItems.ts'

import type { LinearGenomeViewModel } from '../model.ts'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'
import type { MenuItem } from '@jbrowse/core/ui'

function TrackLabelMenu({ track }: { track: BaseTrackModel }) {
  const view = getContainingView(track) as LinearGenomeViewModel
  const session = getSession(track)

  function getMenuItems(): MenuItem[] {
    const orderSubMenu = getTrackOrderSubMenu({ view, track })
    const sessionItems =
      session.getTrackActionMenuItems?.({
        config: track.configuration,
        view,
      }) ?? []

    return [
      ...(orderSubMenu.length
        ? [
            {
              label: 'Track order',
              icon: LowPriorityIcon,
              type: 'subMenu' as const,
              priority: 1000,
              subMenu: orderSubMenu,
            },
          ]
        : []),
      ...sessionItems,
      track.saveTrackDataMenuItem,
      ...track.trackMenuItems(),
    ].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
  }

  return (
    <CascadingMenuButton
      menuItems={getMenuItems}
      data-testid="track_menu_icon"
      data-trackid={track.trackId}
      tooltip="Track settings"
    >
      <MoreVertIcon fontSize="small" />
    </CascadingMenuButton>
  )
}

export default TrackLabelMenu
