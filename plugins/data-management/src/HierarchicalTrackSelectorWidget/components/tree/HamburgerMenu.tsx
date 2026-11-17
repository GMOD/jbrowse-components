import { Suspense, lazy, useState } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import {
  getSession,
  isSessionModelWithConnectionEditing,
  isSessionModelWithConnections,
  isSessionWithPublishTrackConf,
} from '@jbrowse/core/util'
import MenuIcon from '@mui/icons-material/Menu'
import { observer } from 'mobx-react'

import {
  showAddConnectionWidget,
  showAddTrackWidget,
} from '../../showAddWidget.ts'

import type { HierarchicalTrackSelectorModel } from '../../model.ts'
import type { BaseConnectionConfigModel } from '@jbrowse/core/pluggableElementTypes/models/baseConnectionConfig'
import type { MenuItem } from '@jbrowse/core/ui'

// lazy components
const DeleteConnectionDialog = lazy(
  () => import('../dialogs/DeleteConnectionDialog.tsx'),
)
const ManageConnectionsDialog = lazy(
  () => import('../dialogs/ManageConnectionsDialog.tsx'),
)

interface DialogDetails {
  name: string
  connectionConf: BaseConnectionConfigModel
}

const HamburgerMenu = observer(function HamburgerMenu({
  model,
  viewMenuItems,
}: {
  model: HierarchicalTrackSelectorModel
  viewMenuItems?: () => MenuItem[]
}) {
  const session = getSession(model)
  const [deleteDialogDetails, setDeleteDialogDetails] =
    useState<DialogDetails>()
  const [connectionManagerOpen, setConnectionManagerOpen] = useState(false)

  return (
    <>
      <CascadingMenuButton
        data-testid="track-selector-hamburger"
        tooltip="Track selector menu"
        menuItems={() => [
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
          // only offer the Connections submenu when the session can edit
          // connections, otherwise it opens to an empty popup
          ...(isSessionModelWithConnectionEditing(session)
            ? [
                {
                  label: 'Connections',
                  subMenu: [
                    {
                      label: 'Add connection...',
                      onClick: () => {
                        showAddConnectionWidget(session)
                      },
                    },
                    {
                      label: 'Delete connections...',
                      onClick: () => {
                        setConnectionManagerOpen(true)
                      },
                    },
                  ],
                },
              ]
            : []),
          {
            label: 'Clear favorites',
            disabled: model.favorites.length === 0,
            onClick: () => {
              model.clearFavorites()
            },
          },
          {
            label: 'Clear recently used',
            disabled: model.recentlyUsed.length === 0,
            onClick: () => {
              model.clearRecentlyUsed()
            },
          },
          ...(viewMenuItems?.() ?? []),
        ]}
      >
        <MenuIcon />
      </CascadingMenuButton>
      <Suspense fallback={null}>
        {deleteDialogDetails && isSessionModelWithConnections(session) ? (
          <DeleteConnectionDialog
            handleClose={() => {
              setDeleteDialogDetails(undefined)
            }}
            deleteDialogDetails={deleteDialogDetails}
            session={session}
          />
        ) : null}
        {connectionManagerOpen ? (
          <ManageConnectionsDialog
            handleClose={() => {
              setConnectionManagerOpen(false)
            }}
            onDelete={conf => {
              setDeleteDialogDetails({
                name: readConfObject(conf, 'name'),
                connectionConf: conf,
              })
            }}
            session={session}
          />
        ) : null}
      </Suspense>
    </>
  )
})

export default HamburgerMenu
