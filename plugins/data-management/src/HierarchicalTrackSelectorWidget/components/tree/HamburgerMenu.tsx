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
import { getAllSubcategories } from '../../util.ts'

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

function categoryIds(model: HierarchicalTrackSelectorModel) {
  return model.hierarchy.children.flatMap(group =>
    group.type === 'category' ? getAllSubcategories(group) : [],
  )
}

// with no group row to carry them, the tree's own collapse rows sit here
function collapseMenuItems(model: HierarchicalTrackSelectorModel) {
  return model.trackList === 'all' &&
    !model.groupRowsDrawn &&
    model.allTracks.some(g => g.tracks.some(t => t.categories.length > 0))
    ? [
        {
          label: 'Collapse all categories',
          onClick: () => {
            for (const id of categoryIds(model)) {
              model.setCategoryCollapsed(id, true)
            }
          },
        },
        {
          label: 'Expand all categories',
          onClick: () => {
            for (const id of categoryIds(model)) {
              model.setCategoryCollapsed(id, false)
            }
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
  const menuItems = () => [
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
    ...(tableMenuItems ? tableMenuItems() : collapseMenuItems(model)),
  ]
  return tableMenuItems || menuItems().length > 0 ? (
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
