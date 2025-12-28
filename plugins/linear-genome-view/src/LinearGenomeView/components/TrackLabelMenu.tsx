import { useCallback } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { getContainingView, getSession } from '@jbrowse/core/util'
import AddIcon from '@mui/icons-material/Add'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown'
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp'
import MinimizeIcon from '@mui/icons-material/Minimize'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import PushPinIcon from '@mui/icons-material/PushPin'
import { observer } from 'mobx-react'

import type { LinearGenomeViewModel } from '../model'
import type { BaseTrackModel } from '@jbrowse/core/pluggableElementTypes/models'

const TrackLabelMenu = observer(function TrackLabelMenu({
  track,
}: {
  track: BaseTrackModel
}) {
  const view = getContainingView(track) as LinearGenomeViewModel
  const session = getSession(track)

  const getMenuItems = useCallback(() => {
    const trackConf = track.configuration
    const minimized = track.minimized
    const pinned = track.pinned
    const { isTopLevelView } = view

    return [
      ...(!isTopLevelView
        ? []
        : [
            {
              label: pinned ? 'Unpin track' : 'Pin track',
              shortcut: 'p',
              icon: PushPinIcon,
              onClick: () => {
                track.setPinned(!pinned)
              },
            },
          ]),
      {
        label: 'Track order',
        type: 'subMenu' as const,
        shortcut: 'o',
        priority: 2000,
        subMenu: [
          {
            label: minimized ? 'Restore track' : 'Minimize track',
            shortcut: 'i',
            icon: minimized ? AddIcon : MinimizeIcon,
            onClick: () => {
              track.setMinimized(!minimized)
            },
          },
          ...(view.tracks.length > 2
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
          ...(view.tracks.length > 1
            ? [
                {
                  label: 'Move track up',
                  shortcut: 'u',
                  icon: KeyboardArrowUpIcon,
                  onClick: () => {
                    view.moveTrackUp(track.id)
                  },
                },
                {
                  label: 'Move track down',
                  shortcut: 'd',
                  icon: KeyboardArrowDownIcon,
                  onClick: () => {
                    view.moveTrackDown(track.id)
                  },
                },
              ]
            : []),
          ...(view.tracks.length > 2
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
        ],
      },
      ...(session.getTrackActionMenuItems?.(trackConf) || []),
      ...track.trackMenuItems(),
    ].sort((a, b) => (b?.priority || 0) - (a?.priority || 0))
  }, [track, view, session])

  const showShortcuts =
    'showMenuShortcuts' in session ? session.showMenuShortcuts : true

  return (
    <CascadingMenuButton
      menuItems={getMenuItems}
      data-testid="track_menu_icon"
      showShortcuts={showShortcuts}
    >
      <MoreVertIcon fontSize="small" />
    </CascadingMenuButton>
  )
})

export default TrackLabelMenu
