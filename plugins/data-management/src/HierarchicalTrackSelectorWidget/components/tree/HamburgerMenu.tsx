import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  getSession,
  isSessionModelWithConnectionEditing,
  isSessionWithPublishTrackConf,
} from '@jbrowse/core/util'
import MenuIcon from '@mui/icons-material/Menu'
import { observer } from 'mobx-react'

import {
  showAddConnectionWidget,
  showAddTrackWidget,
} from '../../showAddWidget.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

function clearListMenuItems(model: HierarchicalTrackSelectorModel) {
  const session = getSession(model)
  return model.trackList === 'favorites' && model.favoriteTracks.length > 0
    ? [
        {
          label: 'Clear favorites',
          onClick: () => {
            const previous = model.favorites
            model.clearFavorites()
            session.notify('Cleared favorites', 'info', {
              name: 'Undo',
              onClick: () => {
                for (const trackId of previous) {
                  model.addToFavorites(trackId)
                }
              },
            })
          },
        },
      ]
    : model.trackList === 'recent' && model.recentlyUsedTracks.length > 0
      ? [
          {
            label: 'Clear recently used',
            onClick: () => {
              model.clearRecentlyUsed()
            },
          },
        ]
      : []
}

const HamburgerMenu = observer(function HamburgerMenu({
  model,
  tableMenuItems,
}: {
  model: HierarchicalTrackSelectorModel
  tableMenuItems?: () => MenuItem[]
}) {
  const session = getSession(model)
  const menuItems = [
    ...(isSessionWithPublishTrackConf(session)
      ? [
          {
            label: 'Add track...',
            onClick: () => {
              showAddTrackWidget(
                session,
                model.view?.id,
                model.trackContainerId,
              )
            },
          },
        ]
      : []),
    ...(isSessionModelWithConnectionEditing(session)
      ? [
          {
            label: 'Add connection...',
            onClick: () => {
              showAddConnectionWidget(session)
            },
          },
        ]
      : []),
    ...clearListMenuItems(model),
    ...(tableMenuItems?.() ?? []),
  ]
  return menuItems.length > 0 ? (
    <CascadingMenuButton
      data-testid="track-selector-hamburger"
      tooltip="Track selector menu"
      menuItems={menuItems}
    >
      <MenuIcon />
    </CascadingMenuButton>
  ) : null
})

export default HamburgerMenu
